// define(function(require){
  var Backbone = require('backbone'),
      template = require('../templates/modal_view.hbs'),
      ModalView;

  ModalView = Backbone.View.extend({
    manage: true,
    template: template,
    hasRendered: false,
    className: 'modal',

    initialize: function(){

      window.Modal = this;

    },

    show: function(){
      this.render();
      this.$el.modal('show')
    },

    hide: function(){
      this.$el.modal('hide')
    },

    serialize: function(){
      return {
        modalTitle: this.modalTitle
      };
    }

  })
export default ModalView;
  // return ModalView;
// })
