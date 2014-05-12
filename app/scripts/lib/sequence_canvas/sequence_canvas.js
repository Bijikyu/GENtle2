/**
    Handles displaying a sequence in a canvas
    Is instantiated inside a parent Backbone.View, and is automatically
    rendered.

    @class SequenceCanvas
**/ 
define(function(require) {
  'use strict';
  var Artist        = require('lib/graphics/artist'),
      Lines         = require('lib/sequence_canvas/lines'),
      Caret         = require('lib/sequence_canvas/caret'),
      Hotkeys       = require('lib/hotkeys'),
      Q             = require('q'),
      SequenceCanvas;

  SequenceCanvas = function(options) {
    var _this = this;
    options = options || {};
    this.visible = true;

    // Context binding (context is lost in Promises' `.then` and `.done`)
    _.bindAll(this, 'calculateLayoutSettings', 
                    'display', 
                    'refresh', 
                    'afterNextDisplay',
                    'handleScrolling',
                    'handleClick',
                    'handleKeypress',
                    'handleKeydown',
                    'redraw'
              );

    /**
        Instance of BackboneView in which the canvas lives
        @property view
        @type Backbone.View
    **/
    this.view = options.view;

    /**
        Canvas element as a jQuery object
        @property $canvas
        @type jQuery object
        @default first CANVAS DOM element in `this.view.$el`
    **/
    this.$canvas = options.$canvas || this.view.$('canvas').first();

    /**
        Invisible DIV used to handle scrolling. 
        As high as the total virtual height of the sequence as displayed.
        @property $scrollingChild
        @type jQuery object
        @default `.scrollingChild`
    **/
    this.$scrollingChild = options.$scrollingChild || this.view.$('.scrolling-child').first();

    /**
        Div in which `this.$scrollingChild` will scroll.
        Same height as `this.$canvas`
        @property $scrollingParent
        @type jQuery object
        @default jQuery `.scrollingParent`
    **/
    this.$scrollingParent = options.$scrollingParent || this.view.$('.scrolling-parent').first();

    /**
        Sequence to be displayed
        @property sequence
        @type Sequence (Backbone.Model)
        @default `this.view.model`
    **/
    this.sequence = options.sequence || this.view.model;

    /**
        @property layoutSettings
        @type Object
        @default false
    **/
    this.layoutSettings = {
      canvasDims: {width:1138, height:448},
      pageMargins: {
        left:20,
        top:20, 
        right:20,
        bottom:20
      },
      scrollPercentage: 1.0,
      gutterWidth: 30,
      basesPerBlock: 10,
      basePairDims: {width:10, height:15},
      sequenceLength: this.sequence.length(),
      lines: options.lines || {

        // Blank line
        topSeparator: new Lines.Blank(this, {
          height: 5,
          visible: function() { return _this.sequence.get('displaySettings.rows.separators'); }
        }),

        // Position numbering
        position: new Lines.Position(this, {
          height: 15, 
          baseLine: 15, 
          textFont: "10px Monospace", 
          textColour:"#005",
          transform: function(string) {
            return string.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          },
          visible: _.memoize2(function() { 
            return _this.sequence.get('displaySettings.rows.numbering'); 
          })
        }),

        // Aminoacids
        aa: new Lines.DNA(this, {
          height: 15, 
          baseLine: 15, 
          textFont: "13px Monospace", 
          transform: function(base) {
            return _this.sequence.getAA(_this.sequence.get('displaySettings.rows.aa'), base, parseInt(_this.sequence.get('displaySettings.rows.aaOffset')));
          },
          visible: _.memoize2(function() {
            return _this.sequence.get('displaySettings.rows.aa') != 'none';
          }),
          textColour: function(codon) { return {'STP': 'red', 'S  ': 'red'}[codon.sequence] || '#79B6F9'; }
        }),

        // DNA Bases
        dna: new Lines.DNA(this, {
          height: 15, 
          baseLine: 15, 
          textFont: "15px Monospace", 
          textColour:"#000"
        }),

        // Complements
        complements: new Lines.DNA(this, {
          height: 15, 
          baseLine: 15, 
          textFont: "15px Monospace", 
          textColour:"#bbb",
          getSubSeq: _.partial(this.sequence.getTransformedSubSeq, 'complements', {}),
          visible: _.memoize2(function() { 
            return _this.sequence.get('displaySettings.rows.complements'); 
          })
        }),

        // Annotations
        features: new Lines.Feature(this, {
          unitHeight: 15,
          baseLine: 10,
          textFont: "11px Monospace", 
          textColour: "white",
          textPadding: 2,
          margin: 2,
          lineSize: 2,
          colour: function(type) { return {'CDS': 'blue'}[type] || 'red';},
          visible: _.memoize2(function() { 
            return _this.sequence.get('features') && _this.sequence.get('displaySettings.rows.features'); 
          })
        }),

        // Blank line
        bottomSeparator: new Lines.Blank(this, {
          height: 10,
          visible: _.memoize2(function() { 
            return _this.sequence.get('displaySettings.rows.separators'); 
          })
        })
      }
    };

    this.layoutHelpers = {};
    this.artist = new Artist(this.$canvas);
    this.caret = new Caret(this);
    this.allowedInputChars = ['A', 'T', 'C', 'G'];
    this.displayDeferred = Q.defer();

    // Events
    this.view.on('resize', this.refresh);
    this.sequence.on('change:sequence', this.redraw);
    this.sequence.on('change:displaySettings.*', this.refresh);
    this.$scrollingParent.on('scroll', this.handleScrolling);
    this.$scrollingParent.on('click', this.handleClick);
    this.$scrollingParent.on('keypress', this.handleKeypress);
    this.$scrollingParent.on('keydown', this.handleKeydown);

    // Kickstart rendering
    this.refresh();
  };

  // _.extend(SequenceCanvas.prototype, Backbone.Events);

  /**
      Updates Canvas Dimemnsions based on viewport.
      @method updateCanvasDims
      @returns {Promise} a Promise finished when this and `this.calculateLayoutSettings` are finished
  **/
  SequenceCanvas.prototype.updateCanvasDims = function() {
    var _this = this;

    return Q.promise(function(resolve, reject) {
      // Updates width of $canvas to take scrollbar of $scrollingParent into account
      _this.$canvas.width(_this.$scrollingChild.width());

      var width   = _this.$canvas[0].scrollWidth,
          height  = _this.$canvas[0].scrollHeight;

      _this.layoutSettings.canvasDims.width = width;
      _this.layoutSettings.canvasDims.height = height;

      _this.$canvas[0].width = width;
      _this.$canvas[0].height = height;

      resolve();
    });
  };


  /**
      Calculate "helper" layout settings based on already set layout settings
      @method calculateLayoutSettings
      @returns {Promise} a Promise fulfilled when finished
  **/
  SequenceCanvas.prototype.calculateLayoutSettings = function() {
    //line offsets
    var line_offset = _.values(this.layoutSettings.lines)[0].height,
        i, 
        blocks_per_row,
        ls = this.layoutSettings,
        lh = this.layoutHelpers,
        _this = this;

    return Q.promise(function(resolve, reject) {

      //basesPerRow
      blocks_per_row = Math.floor( (ls.canvasDims.width + ls.gutterWidth - (ls.pageMargins.left + ls.pageMargins.right))/(ls.basesPerBlock * ls.basePairDims.width + ls.gutterWidth) );
      if (blocks_per_row !== 0){
        lh.basesPerRow = ls.basesPerBlock*blocks_per_row;
      }else{
        lh.basesPerRow = Math.floor((ls.canvasDims.width + ls.gutterWidth - (ls.pageMargins.left + ls.pageMargins.right))/ls.basePairDims.width);
        //we want bases per row to be a multiple of 10 (DOESNT WORK)
        if (lh.basesPerRow > 5){
          lh.basesPerRow = 5;
        }else if (lh.basesPerRow > 2){
          lh.basesPerRow = 2;
        }else{
          lh.basesPerRow = 1;
        }
      }

      lh.lineOffsets = {};
      _.each(ls.lines, function(line, lineName) {
        line.clearCache();
        if(line.visible === undefined || line.visible()) {
          lh.lineOffsets[lineName] = line_offset;
          if(_.isFunction(line.calculateHeight)) line.calculateHeight();
          line_offset += line.height;
        }
      });

      //row height
      lh.rows = {height:line_offset};

      //total number of rows in sequence, 
      lh.rows.total = Math.ceil(ls.sequenceLength / lh.basesPerRow) ;
      // number of visible rows in canvas
      lh.rows.visible = Math.ceil(ls.canvasDims.height / lh.rows.height) ;

      //page dims
      lh.pageDims = {
        width:ls.canvasDims.width, 
        height: ls.pageMargins.top + ls.pageMargins.bottom + lh.rows.total*lh.rows.height 
      };

      // canvas y offset
      lh.yOffset = lh.yOffset || _this.sequence.get('displaySettings.yOffset') || 0;
      // if (ls.canvasDims.height < lh.pageDims.height){
      //   lh.yOffset = (lh.pageDims.height - ls.canvasDims.height) * ls.scrollPercentage ;
      // }

      // first row (starting at which row do we need to actually display them)
      lh.rows.first = Math.floor((lh.yOffset - ls.pageMargins.top)/lh.rows.height);
      if (lh.rows.first < 0) lh.rows.first = 0;

      _this.$scrollingParent.scrollTop(
        _this.yOffset = _this.sequence.get('displaySettings.yOffset') || 0
      );

      _this.clearCache(); 

      // We resize `this.$scrollingChild` and fullfills the Promise
      _this.resizeScrollHelpers().then(resolve);
    });
  };

  /** 
      If `this.visible`, displays the sequence in the initiated canvas.
      @method display
  **/
  SequenceCanvas.prototype.display = function() {
    if(this.visible) {
      var context         = this.artist.context,
          ls              = this.layoutSettings,
          lh              = this.layoutHelpers,
          _this           = this,
          i, k, pos, baseRange, y;

      return Q.promise(function(resolve, reject){
        //clear canvasaa
        context.clearRect(0,0,context.canvas.width, context.canvas.height);

        _this.forEachRowInRange(0, ls.canvasDims.height, function(y) {
          baseRange = _this.getBaseRangeFromYPos(y);
          _.each(ls.lines, function(line, key) {
            if(line.visible === undefined || line.visible()) {
              line.draw(y, baseRange);
              y += line.height;
            }
          });
        });

        _this.displayDeferred.resolve();
        _this.displayDeferred = Q.defer();
        resolve();

      });
    } else{
      return Q.promise(function(resolve, reject) {
        reject();
      });
    }
  };


  /**
  @method forEachRowInWindow
  @param startY {integer} start of the visibility window
  @param endY {integer} end of the visibility window
  @param 
    callback {function} function to execute for each row. 
    Will be passed the y-offset in canvas.
  */
  SequenceCanvas.prototype.forEachRowInRange = function(startY, endY, callback) {
    var firstRowStartY  = this.getRowStartY(startY),
        y;

    for(y = firstRowStartY; 
        y < Math.min(endY, this.layoutSettings.canvasDims.height - this.layoutSettings.pageMargins.bottom); 
        y += this.layoutHelpers.rows.height)
      callback.call(this, y);
  };

  /**
  @method getRowStartX
  @param posY {integer} Y position in the row (relative to the canvas)
  @return {integer} Y-start of the row (relative to canvas)
  **/
  SequenceCanvas.prototype.getRowStartY = function(posY) {
    return posY - 
      (posY + 
        this.layoutHelpers.yOffset - 
        this.layoutSettings.pageMargins.top
      ) % 
      this.layoutHelpers.rows.height;
  };

  /**
  @method getBaseRangeFromYPos
  @param posY {integer} Y position in the canvas
  @return {Array} First and last bases in the row at the y-pos
  **/
  SequenceCanvas.prototype.getBaseRangeFromYPos = function(posY) {
    var rowNumber = Math.round((this.getRowStartY(posY) + this.layoutHelpers.yOffset) / this.layoutHelpers.rows.height),
        firstBase = rowNumber * this.layoutHelpers.basesPerRow;
    return [firstBase, firstBase + this.layoutHelpers.basesPerRow - 1];
  };

  /**
  @method getBaseFromXYPos
  **/
  SequenceCanvas.prototype.getBaseFromXYPos = function(posX, posY) {
    var layoutSettings  = this.layoutSettings,
        baseRange       = this.getBaseRangeFromYPos(posY),
        baseWidth       = layoutSettings.basePairDims.width,
        basesPerBlock   = layoutSettings.basesPerBlock,
        blockSize       = baseWidth * basesPerBlock + layoutSettings.gutterWidth,
        marginLeft      = layoutSettings.pageMargins.left,
        block           = Math.floor((posX - marginLeft) / blockSize),
        inBlockAbsPos   = (posX - marginLeft) % blockSize / baseWidth,
        inBlockPos      = Math.floor(inBlockAbsPos),
        nextBase        = + (inBlockAbsPos - inBlockPos > 0.5);

    return baseRange[0] + block * basesPerBlock + inBlockPos + nextBase;
  };

  /**
  @method getXPosFromBase
  **/
  SequenceCanvas.prototype.getXPosFromBase = _.memoize2(function(base) {
    var layoutSettings = this.layoutSettings,
        layoutHelpers = this.layoutHelpers,
        firstBaseInRange = base - base % layoutHelpers.basesPerRow,
        deltaBase = base - firstBaseInRange,
        nbGutters = (deltaBase - deltaBase % layoutSettings.basesPerBlock) / layoutSettings.basesPerBlock;

    return layoutSettings.pageMargins.left + 
      deltaBase * layoutSettings.basePairDims.width + 
      nbGutters * layoutSettings.gutterWidth;
  });

  /**
  @method getYPosFromBase
  **/
  SequenceCanvas.prototype.getYPosFromBase = _.memoize2(function(base) {
    var layoutSettings = this.layoutSettings,
        layoutHelpers = this.layoutHelpers,
        rowNb = Math.floor(base / layoutHelpers.basesPerRow),
        topMargin = layoutSettings.pageMargins.top,
        yOffset = layoutHelpers.yOffset;

    return layoutHelpers.rows.height * rowNb + topMargin - yOffset;
  });




  /**
  Resizes $scrollingChild after window/parent div has been resized
  @method resizeScrollHelpers
  @return {Promise}
  **/
  SequenceCanvas.prototype.resizeScrollHelpers = function() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.$scrollingChild.height(_this.layoutHelpers.pageDims.height);
      resolve();
    });
  };

  /**
  Updates layout settings and redraws canvas
  @method refresh
  **/
  SequenceCanvas.prototype.refresh = function() {
    this.updateCanvasDims()
      .then(this.calculateLayoutSettings)
      .then(this.redraw);
  };

  /**
  Redraws canvas on the next animation frame
  @method redraw
  **/
  SequenceCanvas.prototype.redraw = function() {
    return requestAnimationFrame(this.display);
  };

  /** 
  Handles scrolling events
  @method handleScrolling
  **/
  SequenceCanvas.prototype.handleScrolling = function(event) {
    var _this = this;
    requestAnimationFrame(function() { 
      _this.sequence.set('displaySettings.yOffset', 
        _this.layoutHelpers.yOffset = $(event.delegateTarget).scrollTop(),
        { silent: true }
      );
      _this.sequence.throttledSave();
      _this.display();
    });  
  };

  SequenceCanvas.prototype.clearCache = function() {
    this.getXPosFromBase.cache = {};
    this.getYPosFromBase.cache = {};
  };

  SequenceCanvas.prototype.afterNextDisplay = function(resolve) {
    var _this = this;
    this.displayDeferred.promise.then(function() {
      resolve.call(_this);
    });
  };

  /**
  Displays the caret at the mouse click position
  @method handleClick
  @param event [event] Click event
  **/
  SequenceCanvas.prototype.handleClick = function(event) {
    var mouseX = event.offsetX,
        mouseY = event.offsetY - this.layoutHelpers.yOffset,
        base = this.getBaseFromXYPos(mouseX, mouseY);
    
    this.displayCaret(base);
  };

  /**
  Displays the caret before a base
  @method displayCaret
  @param base [base] 
  **/
  SequenceCanvas.prototype.displayCaret = function(base) {
    var lineOffsets = this.layoutHelpers.lineOffsets,
        posX = this.getXPosFromBase(base),
        posY = this.getYPosFromBase(base) + lineOffsets.dna;

    this.caret.move(posX, posY);
    this.caretPosition = base;
  };

  /**
  Handles keystrokes on keypress events
  @method handleKeypress
  @param event [event] Keypress event
  **/
  SequenceCanvas.prototype.handleKeypress = function(event) {
    event.preventDefault();

    if(!~_.values(Hotkeys).indexOf(event.keyCode)) {
      var base = String.fromCharCode(event.which).toUpperCase();

      if(~this.allowedInputChars.indexOf(base)) {
        this.caret.remove();
        this.sequence.insertBases(base, this.caretPosition);
        this.afterNextDisplay(function() {
          this.displayCaret(this.caretPosition + 1);
        });
      }
    }
  };

  /**
  Handles keystrokes on keydown events
  @method handleKeydown
  @param event [event] Keydown event
  **/
  SequenceCanvas.prototype.handleKeydown = function(event) {
    var basesPerRow = this.layoutHelpers.basesPerRow;

    if(~_.values(Hotkeys).indexOf(event.keyCode)) {
      event.preventDefault();

      switch(event.keyCode) {
        case Hotkeys.BACKSPACE:
          if(this.caretPosition > 0) {
            this.caret.remove();
            this.sequence.deleteBases(this.caretPosition - 1, 1);
            this.afterNextDisplay(function() {
              this.displayCaret(this.caretPosition - 1);
            });
          }
          break;

        case Hotkeys.ESC: 
          this.caret.remove();
          this.caretPosition = undefined;
          break;

        case Hotkeys.LEFT:
          if(this.caretPosition > 0) {
            this.displayCaret(this.caretPosition - 1);
          }
          break;

        case Hotkeys.RIGHT:
          if(this.caretPosition < this.sequence.length() - 1) {
            this.displayCaret(this.caretPosition + 1);
          }
          break;

        case Hotkeys.UP:
          if(this.caretPosition >= basesPerRow) {
            this.displayCaret(this.caretPosition - basesPerRow);
          }
          break;

        case Hotkeys.DOWN:
          if(this.caretPosition + basesPerRow < this.sequence.length()) {
            this.displayCaret(this.caretPosition + basesPerRow);  
          }
          break;

      }
    }
  };


  

  return SequenceCanvas;
});