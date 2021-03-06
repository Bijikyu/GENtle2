import Backbone from 'backbone.mixed';
import template from '../templates/sequencing_primers_view.hbs';
import {getAllPrimersAndProductsHelper} from '../lib/sequencing_primers_design';
import ProductsView from './sequencing_primers_products_view';
import CanvasView from './sequencing_primers_canvas_view';
import Gentle from 'gentle';
import Sequence from '../../../sequence/models/sequence';
import {namedHandleError} from '../../../common/lib/handle_error';
import errors from '../lib/errors';
import _ from 'underscore';


export default Backbone.View.extend({
  manage: true,
  template: template,

  events: {
    'click .start-sequencing-primers': 'startCalculation'
  },

  initialize: function() {
    this.model = Gentle.currentSequence;

    var products = this.getProducts();
    this.model.set('sequencingProducts', products);

    this.productsView = new ProductsView(); 
    this.setView('.sequencing-primers-products-container', this.productsView);
    this.canvasView = new CanvasView();
    this.setView('.sequencing-primers-canvas-container', this.canvasView);
  },

  getProducts: function () {
    return this.model.get('sequencingProducts') || [];
  },

  serialize: function() {
    return {
      products: this.getProducts()
    };
  },

  afterRender: function() {
    if(!this.getProducts().length) this.startCalculation();
  },

  startCalculation: function(event) {
    if(event) event.preventDefault();
    this.$('.start-sequencing-primers').hide();
    this.$('.new-sequencing-primers-progress').show();
    var $status = this.$('.new-sequencing-primers-progress .status');

    getAllPrimersAndProductsHelper(this.model)
    .progress((progressOrStatus) => {
      if(progressOrStatus instanceof errors.UniversalPrimerNotFound) {
        if(progressOrStatus instanceof errors.UniversalForwardPrimerNotFound) {
          $status.find('.no-universal-forward-primer').show();
        } else if(progressOrStatus instanceof errors.UniversalReversePrimerNotFound) {
          $status.find('.no-universal-reverse-primer').show();
        }
      } else {
        this.updateProgress(progressOrStatus);
      }
    })
    .then((results) => {
      this.model.set('sequencingProducts', results).throttledSave();
      this.render();
    })
    .catch((error) => {
      // We have been passed a message.
      if(error instanceof Error) {
        this.updateProgress(100).css('background-color', '#C00');

        var missingForwardUP = error.data.notifications.universalForwardPrimerNotFound;
        var missingReverseUP = error.data.notifications.universalReversePrimerNotFound;
        var missingOneOrMoreUniversalPrimers = !!(missingForwardUP || missingReverseUP);
        if(error instanceof errors.SequenceTooShort) {
          $status.find('.sequence-too-short').show();
        } else if(error instanceof errors.NoPrimer) {
          // MAYBE we want to still display primers (would have to modify
          // `getPrimersInOneDirection` and `getAllPrimersAndProducts`).
          $status.find('.no-primer-possible').show();
          if(missingOneOrMoreUniversalPrimers) {
            $status.find('.no-primer-possible .no-universal-primer').show();
          }
        } else if(error instanceof errors.DnaLeftUnsequenced) {
          // MAYBE we want to still display primers (they are available from
          // `error.data.sequencingProductsAndPrimers`).
          $status.find('.unsequenced-dna').show();
          if(missingOneOrMoreUniversalPrimers) {
            $status.find('.unsequenced-dna .no-universal-primer').show();
          } else {
            $status.find('.unsequenced-dna .universal-primers-present').show();
          }
        } else {
          $status.find('.unknown-error-occured').show();
        }
      } else {
        namedHandleError('startCalculation')(error);
      }
    })
    .done();
  },

  updateProgress: function(progress) {
    return this.$('.new-sequencing-primers-progress .progress-bar').css('width', progress*100+'%');
  },

  getSequence: function() {
    var features = [];
    var products = this.getProducts();
    if(_.isEmpty(products)) return;

    _.each(products, function(product) {
      var primer = product.primer;
      if(primer) {
        features.push({
          name: primer.name,
          _type: 'primer',
          _id: product.id,
          ranges: [{
            from: primer.range.from,
            to: primer.range.to - 1,
            reverseComplement: primer.range.reverse,
          }]
        });
      }

    });

    return new Sequence({
      sequence: this.model.getSequence(),
      features: features
    });
  },

  scrollToProduct: function(productId) {
    var product = _.findWhere(this.getProducts(), {id: productId});
    var canvasView = this.canvasView;
    canvasView._freezeScrolling = true;
    canvasView.sequenceCanvas.scrollToBase(product.primer.range.from, false).then(() => {
      canvasView._freezeScrolling = false;
    });
  },


});
