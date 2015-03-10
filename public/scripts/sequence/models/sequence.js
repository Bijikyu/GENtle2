/**
Handling sequences
@class Sequence
@module Sequence
@submodule Models
@main Models
**/
import Gentle from 'gentle';
import SequenceTransforms from '../lib/sequence_transforms';
import HistorySteps from './history_steps';
import Backbone from 'backbone';
import _ from 'underscore';

export default Backbone.DeepModel.extend({
  defaults: function() {
    return {
      id: _.uniqueId(),
      readOnly: false,
      isCircular: false,
      displaySettings: {
        rows: {
          numbering: true,
          features: true,
          complements: true,
          aa: 'none',
          aaOffset: 0,
          res: Gentle.currentUser.get('displaySettings.rows.res')
        }
      },
      history: new HistorySteps()
    };
  },

  constructor: function() {
    var defaults = this.defaults();
    Backbone.DeepModel.apply(this, arguments);
    this.sortFeatures();
    if(this.get('displaySettings.rows.res.lengths') === undefined) 
      this.set('displaySettings.rows.res.lengths', defaults.displaySettings.rows.res.lengths);
    if(this.get('displaySettings.rows.res.custom') === undefined) 
      this.set('displaySettings.rows.res.custom', defaults.displaySettings.rows.res.manual);
    this.maxOverlappingFeatures = _.memoize2(this._maxOverlappingFeatures);
    this.nbFeaturesInRange = _.memoize2(this.nbFeaturesInRange);
    this.listenTo(this, 'change:sequence', this.clearBlastCache);
  },

  /**
  Returns the subsequence between the bases startBase and end Base
  @method getSubSeq
  @param {Integer} startBase start of the subsequence (indexed from 0)
  @param {Integer} endBase end of the subsequence (indexed from 0)
  **/
  getSubSeqWithoutStickyEnds: function(startBase, endBase) {
    if (endBase === undefined)
      endBase = startBase;
    else {
      if (endBase >= this.length() && startBase >= this.length()) return '';
      endBase = Math.min(this.length() - 1, endBase);
    }
    startBase = Math.min(Math.max(0, startBase), this.length() - 1);
    return this.attributes.sequence.substr(startBase, endBase - startBase + 1);
  },

  getSubSeq: function(startBase, endBase, reverse = false) {
    // var stickyEnds = this.get('stickyEnds');
    // var prefix = '';
    // var suffix = '';
    // var seqLength = this.length();

    // endBase = Math.min(endBase, seqLength - 1);

    // var subSeqStart = startBase;
    // var subSeqEnd = endBase;

    // var stickyEndFrom, stickyEndTo;

    // if(stickyEnds) {
    //   var startStickyEnd = stickyEnds && stickyEnds.start;
    //   var endStickyEnd = stickyEnds && stickyEnds.end;

    //   if(startStickyEnd) {
    //     stickyEndFrom = startStickyEnd.offset;
    //     stickyEndTo = stickyEndFrom + startStickyEnd.size;

    //     if(startBase < stickyEndTo) {
    //       if(reverse) {
    //         if(startStickyEnd.reverse) {
    //           subSeqStart = Math.max(startBase, stickyEndFrom);
    //         } else {
    //           subSeqStart = stickyEndTo;
    //         }
    //       } else {
    //         if(startStickyEnd.reverse) {
    //           subSeqStart = stickyEndTo;
    //         } else {
    //           subSeqStart = Math.max(startBase, stickyEndFrom);
    //         }
    //       }
    //     }
    //   }

    //   if(endStickyEnd) {
    //     stickyEndTo = seqLength - 1 - endStickyEnd.offset;
    //     stickyEndFrom = stickyEndTo - endStickyEnd.size;
        
    //     if(endBase > stickyEndFrom) {
    //       if(reverse) {
    //         if(endStickyEnd.reverse) {
    //           subSeqEnd = Math.min(endBase, stickyEndTo);
    //         } else {
    //           subSeqEnd = Math.max(stickyEndFrom, startBase);
    //         }
    //       } else {
    //         if(endStickyEnd.reverse) {
    //           subSeqEnd = Math.max(stickyEndFrom, startBase);
    //         } else {
    //           subSeqEnd = Math.min(endBase, stickyEndTo);
    //         }
    //       }
    //     }
    //   }
    // } 

    // if(subSeqStart != startBase) {
    //   prefix = ' '.repeat(subSeqStart - startBase);
    // }

    // if(subSeqEnd != endBase) {
    //   suffix = ' '.repeat(endBase - subSeqEnd);
    // }

    // var subSeq = subSeqEnd <= startBase ? '' : 
    //   this.getSubSeqWithoutStickyEnds(subSeqStart, Math.max(subSeqEnd, startBase));

    // return prefix + subSeq + suffix;
    return this.getSubSeqWithoutStickyEnds(startBase, endBase);
  },

  isBeyondStickyEnd: function(pos, reverse = false) {
    var stickyEnds = this.get('stickyEnds');
    var seqLength = this.length();
    var result = false;

    if(stickyEnds) {
      var startStickyEnd = stickyEnds.start;
      var endStickyEnd = stickyEnds.end;

      if(startStickyEnd) {
        if(reverse) {
          if(startStickyEnd.reverse) {
            if(pos < startStickyEnd.offset) {    
              result = true;
            } 
          } else {
            if(pos < startStickyEnd.offset + startStickyEnd.size) {    
              result = true;
            } 
          }
        } else {
          if(startStickyEnd.reverse) {
            if(pos < startStickyEnd.offset + startStickyEnd.size) {    
              result = true;
            } 
          } else {
            if(pos < startStickyEnd.offset) {    
              result = true;
            } 
          }
        }
      } 

      if(endStickyEnd) {
        var stickyEndTo = seqLength - 1 - endStickyEnd.offset;
        var stickyEndFrom = stickyEndTo - endStickyEnd.size + 1;

        if(reverse) {
          if(endStickyEnd.reverse) {
            if(pos > stickyEndTo) {    
              result = true;
            } 
          } else {
            if(pos >= stickyEndFrom) {    
              result = true;
            } 
          }
        } else {
          if(endStickyEnd.reverse) {
            if(pos >= stickyEndFrom) {    
              result = true;
            } 
          } else {
            if(pos > stickyEndTo) {    
              result = true;
            } 
          }
        }
      } 
    } 
    return result;
  },

  /**
  Returns a transformed subsequence between the bases startBase and end Base
  @method getTransformedSubSeq
  @param {String} variation name of the transformation
  @param {Object} options
  @param {Integer} startBase start of the subsequence (indexed from 0)
  @param {Integer} endBase end of the subsequence (indexed from 0)
  **/
  getTransformedSubSeq: function(variation, options, startBase, endBase) {
    options = options || {};
    var output = '';
    switch (variation) {
      case 'aa-long':
      case 'aa-short':
        var paddedSubSeq = this.getPaddedSubSeq(startBase, endBase, 3, options.offset || 0),
          offset;
        output = _.map(paddedSubSeq.subSeq.match(/.{1,3}/g) || [], function(codon) {
          if (options.complements === true) codon = SequenceTransforms.toComplements(codon);
          return SequenceTransforms[variation == 'aa-long' ? 'codonToAALong' : 'codonToAAShort'](codon);
        }).join('');
        offset = Math.max(0, paddedSubSeq.startBase - startBase);
        output = output.substr(Math.max(0, startBase - paddedSubSeq.startBase), endBase - startBase + 1 - offset);
        _.times(Math.max(0, offset), function() {
          output = ' ' + output;
        });
        break;
      case 'complements':
        output = SequenceTransforms.toComplements(this.getSubSeq(startBase, endBase, true));
        break;
    }
    return output;
  },

  /**
  Returns a subsequence including the subsequence between the bases `startBase` and `endBase`.
  Ensures that blocks of size `padding` and starting from the base `offset` in the
  complete sequence are not broken by the beginning or the end of the subsequence.
  @method getPaddedSubSeq
  @param {String} variation name of the transformation
  @param {Integer} startBase start of the subsequence (indexed from 0)
  @param {Integer} endBase end of the subsequence (indexed from 0)
  @param {Integer, optional} offset relative to the start of full sequence
  **/
  getPaddedSubSeq: function(startBase, endBase, padding, offset) {
    offset = offset || 0;
    startBase = Math.max(startBase - (startBase - offset) % padding, 0);
    endBase = Math.min(endBase - (endBase - offset) % padding + padding - 1, this.length());
    return {
      subSeq: this.getSubSeq(startBase, endBase),
      startBase: startBase,
      endBase: endBase
    };
  },

  /**
  @method getCodon
  @param {Integer} base
  @param {Integer, optional} offset
  @returns {Object} codon to which the base belongs and position of the base in the codon (from 0)
  **/
  getCodon: function(base, offset) {
    var subSeq;
    offset = offset || 0;
    subSeq = this.getPaddedSubSeq(base, base, 3, offset);
    if (subSeq.startBase > base) {
      return {
        sequence: this.attributes.sequence[base],
        position: 1
      };
    } else {
      return {
        sequence: subSeq.subSeq,
        position: (base - offset) % 3
      };
    }
  },

  /**
  @method codonToAA
  **/
  getAA: function(variation, base, offset) {
    var codon = this.getCodon(base, offset || 0),
      aa = SequenceTransforms[variation == 'short' ? 'codonToAAShort' : 'codonToAALong'](codon.sequence) || '';
    return {
      sequence: aa || '   ',
      position: codon.position
    };
  },

  /**
  @method featuresInRange
  @param {integer} startBase
  @param {integer} endBase
  @returns {array} all features present in the range
  **/
  featuresInRange: function(startBase, endBase) {
    if (_.isArray(this.attributes.features)) {
      return _(this.attributes.features).filter(function(feature) {
        return !!~_.map(feature.ranges, function(range) {
          return range.from <= endBase && range.to >= startBase;
        }).indexOf(true);
      });
    } else {
      return [];
    }
  },

  /**
  Validates that a sequence name is present
  @method validate
  **/
  validate: function(attrs, options) {
    var errors = [];
    if (!attrs.name.replace(/\s/g, '').length) {
      errors.push('name');
    }
    return errors.length ? errors : undefined;
  },


  /**
  @method maxOverlappingFeatures
  @returns {integer}
  **/
  _maxOverlappingFeatures: function() {
    var ranges = _.flatten(_.pluck(this.attributes.features, 'ranges')),
      previousRanges = [],
      i = 0,
      filterOverlappingRanges = function(ranges) {
        return _.filter(ranges, function(range) {
          return _.some(ranges, function(testRange) {
            return range != testRange && range.from <= testRange.to && range.to >= testRange.from;
          });
        });
      };

    while(ranges.length > 1 && _.difference(ranges, previousRanges).length && i < 100) {
      previousRanges = _.deepClone(ranges);
      ranges = filterOverlappingRanges(ranges);
      i++;
    }
    return i;
  },

  /**
  @method featuresCountInRange
  @returns {integer}
  **/
  nbFeaturesInRange: function(startBase, endBase) {
    return _.filter(this.attributes.features, function(feature) {
      return _.some(feature.ranges, function(range) {
        return range.from <= endBase && range.to >= startBase;
      });
    }).length;
  },

  insertBases: function(bases, beforeBase, updateHistory) {

    var seq = this.get('sequence'),
        timestamp;

    if (updateHistory === undefined) updateHistory = true;
     // if (updateHistory === 'design-true')
     //  this.getHistory().add({
     //    type: 'design-insert',
     //    hidden: true,
     //    position: beforeBase,
     //    value: bases,
     //    operation: '@' + beforeBase + '+' + bases
     //  });
    
    this.set('sequence',
      seq.substr(0, beforeBase) +
      bases +
      seq.substr(beforeBase, seq.length - beforeBase + 1)
    );

    this.moveFeatures(beforeBase, bases.length);

    if (updateHistory) {
      timestamp = this.getHistory().add({
        type: 'insert',
        position: beforeBase,
        value: bases,
        operation: '@' + beforeBase + '+' + bases
      }).get('timestamp');
    }

    this.throttledSave();

    return timestamp;
  },

  moveBases: function(firstBase, length, newFirstBase, updateHistory) {
    var lastBase = firstBase + length - 1,
        history = this.getHistory(),
        _this = this,
        featuresInRange, subSeq, deletionTimestamp, insertionTimestamp;
    
    if(updateHistory === undefined) updateHistory = true;

    featuresInRange = _.deepClone(_.filter(this.get('features'), function(feature) {
      return _.some(feature.ranges, function(range) {
        return range.from >= firstBase && range.to <= lastBase;
      });
    }));

    subSeq = this.getSubSeq(firstBase, lastBase);

    deletionTimestamp = this.deleteBases(firstBase, length, updateHistory);
    insertionTimestamp = this.insertBases(
      subSeq, 
      newFirstBase < firstBase ? 
        newFirstBase : 
        newFirstBase - length
    );

    _.each(featuresInRange, function(feature) {
      feature.ranges = _.map(_.filter(feature.ranges, function(range) {
        return range.from >= firstBase && range.to <= lastBase;
      }), function(range) {
        var offset = newFirstBase < firstBase ? 
          newFirstBase - firstBase : 
          newFirstBase - length - firstBase;

        return {
          from: range.from + offset,
          to: range.to + offset
        };
      });

      _this.createFeature(feature, updateHistory);
    });

  },

  insertBasesAndCreateFeatures: function(beforeBase, bases, features, updateHistory) {
    var newFeatures = _.deepClone(_.isArray(features) ? features : [features]),
        _this = this;
    
    this.insertBases(bases, beforeBase, updateHistory);

    _.each(newFeatures,function(feature){

      feature.ranges = [{
        from: beforeBase,
        to: beforeBase + bases.length - 1
      }];

      delete feature.from;
      delete feature.to;

      _this.createFeature(feature, updateHistory); 
    });
  },

  insertSequenceAndCreateFeatures: function(beforeBase, bases, features, updateHistory) {
    var newFeatures = _.deepClone(_.isArray(features) ? features : [features]),
        _this = this;
    
    this.insertBases(bases, beforeBase, updateHistory);

    _.each(newFeatures,function(feature){

      feature.ranges = _.map(feature.ranges, function(range) {
        return {
          from: beforeBase + range.from,
          to: beforeBase + range.to
        };
      });

      _this.createFeature(feature, updateHistory); 
    });
  }, 

  deleteBases: function(firstBase, length, updateHistory) {
    var seq = this.get('sequence'),
        timestamp,
        subseq, linkedHistoryStepTimestamps;

    if (updateHistory === undefined) updateHistory = true;

    subseq = seq.substr(firstBase, length);

    this.set('sequence',
      seq.substr(0, firstBase) +
      seq.substr(firstBase + length, seq.length - (firstBase + length - 1))
    );

    linkedHistoryStepTimestamps = this.moveFeatures(firstBase, -length);

    // if (updateHistory === 'design-true')
    //   this.getHistory().add({
    //     type: 'design-delete',
    //     value: subseq,
    //     hidden: true,
    //     position: firstBase,
    //     operation: '@' + firstBase + '-' + subseq,
    //     linked: linkedHistoryStepTimestamps
    //   });

    if (updateHistory) {
      timestamp = this.getHistory().add({
        type: 'delete',
        value: subseq,
        position: firstBase,
        operation: '@' + firstBase + '-' + subseq,
        linked: linkedHistoryStepTimestamps
      }).get('timestamp');
    }

    this.throttledSave();

    return timestamp;

  },

  moveFeatures: function(base, offset) {
    var features = this.get('features'),
        featurePreviousState,
        storePreviousState,
        firstBase, lastBase,
        trigger = false,
        historyTimestamps = [];

    storePreviousState = function(feature) {
      featurePreviousState = featurePreviousState || _.deepClone(feature);
    };

    if (_.isArray(features)) {

      for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        featurePreviousState = undefined;

        for (var j = 0; j < feature.ranges.length; j++) {
          var range = feature.ranges[j];

          if (offset > 0) {
            
            if (range.from >= base) range.from += offset;
            if (range.to >= base) range.to += offset;
            if (range.from >= base || range.to >= base) trigger = true;

          } else {

            firstBase = base;
            lastBase = base - offset - 1;

            if (firstBase <= range.from) {
              storePreviousState(feature);
              trigger = true;
              if (lastBase >= range.to) {
                feature.ranges.splice(j--, 1);
              } else {
                range.from -= lastBase < range.from ? -offset : range.from - firstBase;
                range.to += offset;
              }
            } else if (firstBase <= range.to) {
              storePreviousState(feature);
              trigger = true;
              range.to = Math.max(firstBase - 1, range.to + offset);
            }

          }
        }
        // If there are no more ranges, we remove the feature and
        // record the operation in the history
        if (feature.ranges.length === 0) {
          historyTimestamps.push(this.recordFeatureHistoryDel(featurePreviousState, true));
          features.splice(i--, 1);
        } else if (featurePreviousState !== undefined) {
          historyTimestamps.push(this.recordFeatureHistoryEdit(featurePreviousState, true));
        }
      }
      this.clearFeatureCache();
      if(trigger) this.trigger('change change:features');

    }

    return historyTimestamps;
  },

  clearFeatureCache: function() {
    this.nbFeaturesInRange.clearCache();
    this.maxOverlappingFeatures.clearCache();
  },

  /**
  @method getHistory
  @returns {HistorySteps} collection of {{#crossLink "HistoryStep"}}{{/crossLink}}
    attached to the model instance
  **/
  getHistory: function() {
    if (this.attributes.history.toJSON === undefined) {
      this.attributes.history = new HistorySteps(this.attributes.history);
    }
    return this.attributes.history;
  },

  /**
  Revert the last {{#crossLink "HistoryStep"}}{{/crossLink}} instance in 
  {{#crossLink "Sequence/getHistory"}}{{/crossLink}} for which `hidden` is not 
  `true`
  @method undo
  **/
  undo: function() {
    var history = this.getHistory(),
        lastStep = history.findWhere({hidden: false}),
        _this = this,
        linkedSteps, revertAndRemove;

    revertAndRemove = function(step) {
      _this.revertHistoryStep(step);
      history.remove(step);
    };

    if (lastStep) {
      linkedSteps = lastStep.get('linked') || [];
      revertAndRemove(lastStep);
      _.each(linkedSteps, function(timestamp) {
        revertAndRemove(history.findWhere({timestamp: timestamp}));
      });
    }
  },

  /**
  Reverts all {{#crossLink "HistoryStep"}}{{/crossLink}} instances after `timestamp`
  in {{#crossLink "Sequence/getHistory"}}Sequence#getHistory{{/crossLink}} for which `hidden` is not 
  `true`
  @method undoAfter
  @param {integer} timestamp
  **/
  undoAfter: function(timestamp) {
    var _this = this,
        history = this.getHistory(),
        linkedSteps, revertAndPush,
        toBeDeleted = [];

    revertAndPush = function(step) {
      toBeDeleted.push(step);
      _this.revertHistoryStep.call(_this, step);
    };

    history.all(function(historyStep) {
      if (historyStep.get('timestamp') >= timestamp) {
        if(!historyStep.get('hidden')) {
          linkedSteps = historyStep.get('linked') || [];
          revertAndPush(historyStep);
          _.each(linkedSteps, function(timestamp) {
            revertAndPush(history.findWhere({timestamp: timestamp}));
          });
        }
        return true;

      } else {
        // the HistorySteps collection is sorted by DESC timestamp
        // so we can break out of the loop.
        return false;
      }
    });

    history.remove(toBeDeleted);
    this.throttledSave();

  },

  revertHistoryStep: function(historyStep) {
    switch (historyStep.get('type')) {

      case 'featureIns':
        this.deleteFeature(historyStep.get('feature'), false);
        break;

      case 'featureEdit':
        this.updateFeature(historyStep.get('featurePreviousState'), false);
        break;

      case 'featureDel':
        this.createFeature(historyStep.get('featurePreviousState'), false);
        break;

      case 'insert':
        this.deleteBases(
          historyStep.get('position'),
          historyStep.get('value').length,
          false
        );
        break;

      case 'delete':
        this.insertBases(
          historyStep.get('value'),
          historyStep.get('position'),
          false
        );
        break;
    }
  },

  updateFeature: function(editedFeature, record) {
    var oldFeature = _.indexBy(this.get('features'), '_id')[editedFeature._id],
      id = this.get('features').indexOf(oldFeature);
    this.clearFeatureCache();
    this.set('features.' + id, editedFeature);
    this.sortFeatures();
    this.save();
    if (record === true) {
      this.recordFeatureHistoryEdit(editedFeature);
    }
    this.throttledSave();
  },

  createFeature: function(newFeature, record) {
    var id = this.get('features').length, sortedIdList, len;

    if (record === true) {
      this.recordFeatureHistoryIns(newFeature);
    } 
    // if (record === 'design-true')
    // this.getHistory().add({
    //   type: 'design-feature-create',
    //   feature: newFeature,
    //   name: newFeature.name,
    //   hidden: true,
    //   featureType: newFeature._type,
    //   range: [{
    //     from: newFeature.ranges[0].from,
    //     to: newFeature.ranges[0].to
    //   }]
    // }).get('timestamp');  

    if (id === 0) {
      newFeature._id = 0;
    } else {
      sortedIdList = _.sortBy(_.pluck(this.get('features'),'_id'));
      len = sortedIdList.length;
      newFeature._id = sortedIdList[len-1]+1;
    }
  
    this.clearFeatureCache();
    this.set('features.' + id, newFeature);
    this.sortFeatures();
    this.throttledSave();
  },


   deleteFeature: function(feature, record) {
    var featureId;
    featureId = (feature._id===undefined)?feature.id : feature._id;
    this.clearFeatureCache();

    if (record === true) {
      this.recordFeatureHistoryDel(feature, false, false);
    }
    //  if (record === 'design-true')
    //  this.getHistory().add({
    //   type: 'design-feature-delete',
    //   feature: feature,
    //   hidden: true,
    //   name: feature.name,
    //   featureType: feature._type,
    //   range: [{
    //     from: feature.ranges[0].from,
    //     to: feature.ranges[0].to
    //   }]
    // }).get('timestamp');

    this.set('features', _.reject(this.get('features'), function(_feature) {
      return _feature._id == featureId;
    }));
   
    this.sortFeatures();
    this.throttledSave();
  },

  recordFeatureHistoryIns: function(feature) {
    return this.getHistory().add({
      type: 'featureIns',
      feature: feature,
      name: feature.name,
      featureType: feature._type,
      range: [{
        from: feature.ranges[0].from,
        to: feature.ranges[0].to
      }]
    }).get('timestamp');
  },

  recordFeatureHistoryDel: function() {
    var feature = arguments[0],
        isHidden = !!arguments[1];

    return this.getHistory().add({
      type: 'featureDel',
      name: feature.name,
      featurePreviousState: feature,
      featureType: feature._type,
      hidden: isHidden
    }).get('timestamp');
  },

  recordFeatureHistoryEdit: function() {
    var feature = arguments[0],
        isHidden = !!arguments[1];

    return this.getHistory().add({
      type: 'featureEdit',
      name: feature.name,
      featurePreviousState: feature,
      featureType: feature._type,
      hidden: isHidden
    }).get('timestamp');
  },

  sortFeatures: function() {
    this.set('features',
      _.sortBy(
        _.map(this.get('features'), function(feature) {
          feature.ranges = _.sortBy(feature.ranges, function(range) {
            return range.from;
          });
          return feature;
        }), function(feature) {
          return feature.ranges[0].from;
        }), {
        silent: true
      });
  },

  length: function() {
    return this.attributes.sequence.length;
  },

  serialize: function() {
    return _.extend(Backbone.Model.prototype.toJSON.apply(this), {
      isCurrent: (Gentle.currentSequence && Gentle.currentSequence.get('id') == this.get('id')),
      length: this.length()
    });
  },

  throttledSave: function() {
    return _.throttle(_.bind(this.save, this), 100)();
  },

  clearBlastCache: function() {
    if(this.get('meta.blast')) {
      this.set('meta.blast', {});
      this.throttledSave();
    }

    return this;
  },

  saveBlastRID: function(RID, database) {
    this.set('meta.blast.RID', RID);
    this.set('meta.blast.database', database);
    this.throttledSave();
    return this;
  },

  saveBlastResults: function(results) {
    this.set('meta.blast.results', results);
    this.throttledSave();
    return this;
  }

});