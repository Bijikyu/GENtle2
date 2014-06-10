/**
Handling history steps
@class HistoryStep
@module Sequence
@submodule Models
**/
define(function(require){
  var Backbone = require('backbone.mixed'),
      HistoryStep;

  HistoryStep = Backbone.Model.extend({
    serialize: function() {
      return _.extend(Backbone.Model.prototype.toJSON.call(this), {
        isInsertion: this.get('type') == 'insert',
        isDeletion: this.get('type') == 'delete',
        isAnnotationInsertion: this.get('type') == 'annotatein',
        isAnnotationDelete: this.get('type') == 'annotatedel',

      });
    }
  });

  return HistoryStep;
});