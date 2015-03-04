define(function(require) {
  var SynbioData = require('../../common/lib/synbio_data');
  var SequenceTransforms = require('./sequence_transforms');
  var restrictionEnzymes;
  var restrictionEnzymesByBases;
  var restrictionEnzymesByLength;
  var iupacToBases = SequenceTransforms.iupacToBases;
  var reverseComplements = SequenceTransforms.toReverseComplements;

  var RestrictionEnzymes = {};

  RestrictionEnzymes.all = function() {
    restrictionEnzymes = restrictionEnzymes || (function() {
      return _.sortBy(_.map(SynbioData.restriction_enzymes, function(enzyme) {
        var bases = enzyme.seq;
        return _.extend(enzyme, {
          isPalindromic: bases == reverseComplements(bases)
        });
      }), 'name');
    })();

    return restrictionEnzymes;
  };

  RestrictionEnzymes.getRegExp = _.memoize2(function(iupacSequence) {
    var pattern = '',
        base;

    for(var i = 0; i < iupacSequence.length; i++) {
      base = iupacToBases(iupacSequence[i]);
      pattern += base.length == 1 ? base : '[' + base + ']';
    }

    return new RegExp(pattern, 'gi');
  });

  RestrictionEnzymes.getComplementEnzyme = _.memoize2(function(enzyme) {
    return {
      name: enzyme.name + '←',
      seq: reverseComplements(enzyme.seq),
      cut: enzyme.seq.length - enzyme.cut - enzyme.offset,
      offset: enzyme.offset
    };
  }, (enzyme) => enzyme.name);

  RestrictionEnzymes.byBases = function() {
    restrictionEnzymesByBases = restrictionEnzymesByBases || (function() {
      var output = {};
      _.each(RestrictionEnzymes.all(), function(enzyme) {
        var bases = enzyme.seq;
        output[bases] = output[bases] || [];
        output[bases].push(enzyme);
      });
      return output;
    })();
    return restrictionEnzymesByBases;
  };

  RestrictionEnzymes.byLength = function() {
    restrictionEnzymesByLength = restrictionEnzymesByLength || (function() {
      var output = {};
      _.each(RestrictionEnzymes.all(), function(enzyme) {
        var length = enzyme.seq.length,
            bases = enzyme.seq;
        output[length] = output[length] || {};
        output[length][bases] = output[length][bases] || [];
        output[length][bases].push(enzyme);
      });
      return output;
    })();
    return restrictionEnzymesByLength;
  };

  RestrictionEnzymes.getAllInSeq = function(seq, options) {
    var matches = {},
        list,
        checkAndAddMatch;
    options = options || {}; 


    checkAndAddMatch = function(enzymes, bases, complement = false) {
      var regexp, result;

      if(!_.isArray(enzymes)) enzymes = [enzymes];

      regexp = RestrictionEnzymes.getRegExp(bases);

      while(result = regexp.exec(seq)) {
        matches[result.index] = (matches[result.index] || []).concat(enzymes);
      }

      if(complement === false) {

        var nonPalindromicEnzymes = _.reject(enzymes, 'isPalindromic');

        if(!_.isEmpty(nonPalindromicEnzymes)) {

          checkAndAddMatch(
            _.map(nonPalindromicEnzymes, RestrictionEnzymes.getComplementEnzyme),
            reverseComplements(bases), 
            true
          );

        }
      }
    };

    if(options.customList && options.customList.length) {
      list = options.customList;
      _.each(RestrictionEnzymes.all(), function(enzyme) {
        if(~list.indexOf(enzyme.name)) checkAndAddMatch(enzyme, enzyme.seq);
      });
    } else if(options && options.length) {
      if(!_.isArray(options.length)) options.length = [options.length];
      _.each(options.length, function(length) {
        _.each(RestrictionEnzymes.byLength()[length], checkAndAddMatch);
      });
    } else {
      _.each(RestrictionEnzymes.byBases(), checkAndAddMatch);
    }

    return matches;
  };

  RestrictionEnzymes.maxLength = _.memoize(function() {
    return _.max(_.map(RestrictionEnzymes.all(), function(enzyme) {
      return enzyme.seq.length;
    }));
  });

  window.re = RestrictionEnzymes;
  window.st = SequenceTransforms;

  return RestrictionEnzymes;
});