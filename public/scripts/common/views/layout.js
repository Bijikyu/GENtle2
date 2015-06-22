/**
@module Common
@submodule Views
**/
// define(function(require) {
  var template      = require('../templates/layout.hbs'),
      NavbarView    = require('./navbar_view'),
      Modal         = require('./modal_view'),
      Backbone      = require('backbone'),
      Layout;

  Layout = Backbone.Layout.extend({
    el: '#wrapper',
    template: template,

    initialize: function() {
      this.setView('#navbar', new NavbarView());
      this.setView('#modal_container', Modal);
    },

  });
export default Layout;
  // return Layout;
// });
