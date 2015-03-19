/**
@module Common
@submodule Views
**/
define(function(require) {
  var template        = require('../templates/context_menu_view.hbs'),
      Backbone        = require('backbone'),
      ContextMenuView;

  ContextMenuView = Backbone.View.extend({
    manage: true,
    template: template,

    events: {
      'click .menu-item, .menu-icon': 'handleClick',
      'click .dropdown-toggle': 'toggleMenu',
      'mouseup .menu-item, .menu-icon, .dropdown-toggle': 'stopPropagation',
      'mousedown .menu-item, .menu-icon, .dropdown-toggle': 'stopPropagation',
    },

    initialize: function(options) {
      this.display = false;
      this.posX = 0;
      this.posY = 0;
      this.width = 240;
      this.menuItemHeight = 25;
      this.menuIconWidth = 34;
      this.reset();
      _.bindAll(this, 'hide');
      $('body').on('click', this.hide);

      this.context = options && options.context;
    },

    reset: function() {
      this.menuItems = [];
      this.menuIcons = [];
      return this;
    },

    add: function(label, icon, callback) {
      var $assumedParent = this.$assumedParent;

      if(callback === undefined) {
        callback = icon;
        icon = undefined;
      }

      if(icon) {
        this.menuIcons.push({
          label: label,
          icon: icon,
          callback: callback,
          id: this.menuItems.length + this.menuIcons.length
        });
      } else {
        this.menuItems.push({
          label: label,
          callback: callback,
          id: this.menuItems.length + this.menuIcons.length
        });
      }

      this.posX = Math.min(
        this.posX,
        $assumedParent.width() + $assumedParent.position().left -
          ((this.menuIcons.length + 1) * this.menuIconWidth + 20)
      );

      return this;
    },

    move: function(posX, posY) {
      var parentOffset = this.$assumedParent.position();

      this.posX = posX + parentOffset.left;
      this.posY = posY + parentOffset.top;

      return this;
    },

    show: function() {
      var itemNb = this.menuItems.length;

      if(this.menuItems.length || this.menuIcons.length) {
        var $parent = this.$assumedParent,
            parentWidth = $parent.width(),
            parentHeight = $parent.height();

        this.pullRight = this.posX - $parent.position().left - this.width > 0;
        this.dropup = this.posY + this.menuItemHeight * itemNb + 40 >= parentHeight;

        _.defer(() => {
          // RACY  this `defer`, and the conditional in hide for `this.display`
          // ensures `show` is run after the `hide` function which 
          // erroneously gets triggered on the 'click' event from a selection 
          // operation...??!!  This was introduced somewhere between:
          //  BAD:  0b9f24a
          //        468a904
          //        37d5e1c  // <- likely "culprit":  `Using gulp instead of grunt (TBC)`
          //  GOOD: 92737fb
          this.render();
          $parent.focus();
          this.display = true;
        });
      }

      return this;
    },

    hide: function() {
      if(this.display) {
        this.display = false;
        this.reset();
        this.render();
      }
      return this;
    },

    handleClick: function(event) {
      var id = $(event.currentTarget).data('id'),
          menuItem =  _.findWhere(this.menuItems, {id: id}) ||
                      _.findWhere(this.menuIcons, {id: id});

      event.preventDefault();

      menuItem.callback.call(this.boundTo);
    },

    stopPropagation: function(event) {
      event.preventDefault();
      event.stopPropagation();
    },

    toggleMenu: function(event) {

      event.stopPropagation();
      event.preventDefault();
      $(event.currentTarget).dropdown('toggle');

    },

    serialize: function() {
      return {
        display: this.display,
        menuItems: this.menuItems,
        menuIcons: this.menuIcons,
        posX: this.posX,
        posY: this.posY,
        pullRight: this.pullRight,
        dropup: this.dropup,
        context: this.context || 'generic'
      };
    },

    remove: function() {
      $('body').off('click', this.hide);
      Backbone.View.prototype.remove.apply(this, arguments);
    }




  });

  return ContextMenuView;
});
