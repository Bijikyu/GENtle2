import Handlers from '../lib/_sequence_canvas_handlers';
import Sequence from '../models/sequence';
import {stubCurrentUser} from '../../common/tests/stubs';


describe('handling keyboard selection events', function() {
  stubCurrentUser();

  var stickyEndSequence = 'GAAGA';
  var mockSequence = new Sequence({
    name: 'Test sequence',
    sequence: 'ATGCATGCATGCATGCATGC' + stickyEndSequence,
    stickyEnds: {
      end: {
        sequence: stickyEndSequence,
        reverse: true,
        offset: 2,
        size: 3,
        name: "Z'",
      }
    }
  });

  var mockSequenceWithStartStickyEnd = new Sequence({
    name: 'Test sequence',
    sequence: stickyEndSequence + 'ATGCATGCATGCATGCATGC',
    stickyEnds: {
      start: {
        sequence: stickyEndSequence,
        reverse: false,
        offset: 2,
        size: 3,
        name: "X",
      }
    }
  });

  it('selects to end of sequence on that line', function() {
    var handler = new Handlers();
    handler.sequence = mockSequence;
    handler.caretPosition = 10;
    handler.layoutHelpers = {basesPerRow: 120};
    handler.selection = undefined;
    handler.select = function() {};
    spyOn(handler, 'select');

    handler.handleRightKey(true, true);
    expect(handler.select).toHaveBeenCalled();
    expect(handler.select).toHaveBeenCalledWith(10, 19);
  });

  it('does not create selection when at end of sequence', function() {
    var handler = new Handlers();
    handler.sequence = mockSequence;
    handler.caretPosition = 20;
    handler.layoutHelpers = {basesPerRow: 120};
    handler.selection = undefined;
    handler.select = function() {};
    spyOn(handler, 'select');

    handler.handleRightKey(true, true);
    expect(handler.select).not.toHaveBeenCalled();
  });

  it('selects correctly went all of sequence selected to left then right', function() {
    var handler = new Handlers();
    handler.sequence = mockSequence;
    handler.caretPosition = 10;
    handler.layoutHelpers = {basesPerRow: 120};
    handler.selection = undefined;
    handler.select = function() {};
    spyOn(handler, 'select');

    handler.handleLeftKey(true, true);
    expect(handler.select).toHaveBeenCalledWith(9, 0);
    handler.handleRightKey(true, true);
    expect(handler.select).toHaveBeenCalledWith(9, 0);
    expect(handler.select).toHaveBeenCalledWith(0, 19);
  });

  it('selects nothing went at start of sequence going left', function() {
    var handler = new Handlers();
    handler.sequence = mockSequenceWithStartStickyEnd;
    // NOTE: Remember this is the size of the uneditable sticky end not the
    // offset.  The bases covered by the offset are stripped away completely
    // and the sequence rebased so that the first base of the actualy sticky
    // end is then in position 0.
    handler.caretPosition = 3;
    handler.layoutHelpers = {basesPerRow: 120};
    handler.selection = undefined;
    handler.select = function() {};
    spyOn(handler, 'select');

    handler.handleLeftKey(true, true);
    expect(handler.select).not.toHaveBeenCalled();
  });
});
