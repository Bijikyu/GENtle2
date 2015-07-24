import Backbone    from 'backbone';
import template    from '../templates/ncbi_view.hbs';
import Gentle      from 'gentle';
import ResultsView from './results_view';
import NCBIRequest   from '../lib/ncbi_request';

var NCBIView = Backbone.View.extend({
  manage: true,
  template: template,
  className: 'home-ncbi',

  events: {
    'submit form': 'triggerSearch',
    'change form input[type="radio"]': 'changeDb',
    'click .ncbi-backlink': 'disableFullscreen'
  },

  initialize: function() {
    this.resultsView = new ResultsView();
    this.dbName = 'nuccore';
  },

  changeDb: function(event) {
    this.dbName = $(event.currentTarget).attr('value');
  },

  triggerSearch: function(event) {
    this.enableFullscreen();
    var $form = this.$('form');
    var searchTerm = $form.find('input[name="search"]').val();

    event.preventDefault();
    this.searchTerm = searchTerm;
    this.results = [];

    if(NCBIRequest.isId(searchTerm)) {
      this.openFromId(searchTerm);
    } else {
      this.searchNCBI(searchTerm);
    }
    
  },

  openFromId: function(id) {
    return NCBIRequest.loadFromId(id, this.dbName)
      .then(Gentle.addSequencesAndNavigate)
      .catch(function() {
        alert('The sequence could not be parsed.');
      });
  },

  searchNCBI: function(searchTerm) {
    this.$('.searching-ncbi').show();
    this.$('.ncbi-search-results-outlet').html('');

    NCBIRequest.search(searchTerm, this.dbName).then((results) => {
      this.results = results;
      this.$('.searching-ncbi').hide();
      this.resultsView.render();
    });
  },

  // parseNCBISearchResponseAndGetIds: function(response) {
  //   var ids, $response, url;

  //   $response = $($.parseXML(response));
  //   ids = _.map($response.find('eSearchResult > IdList > Id'), function(id) {
  //     return $(id).text();
  //   });

  //   url = NCBIUrls.loadIds
  //     .replace('{{dbName}}', this.dbName)
  //     .replace('{{ids}}', ids.join(','));

  //   Proxy.get(url).then((results) => {

  //   }this.parseNCBIIdsResponse, function() {
  //     alert('There was an issue searching the NCBI database');
  //   });

  // },

  // parseNCBIIdsResponse: function(response) {
  //   var $response;

  //   $response = $($.parseXML(response));
  //   this.results = _.map($response.find('DocSum'), function(result) {
  //     var output = {},
  //         attributes = ['Caption', 'Title', 'Length'];

  //     _.each(attributes, function(attribute) {
  //       output[attribute.toLowerCase()] = $(result).find('[Name="'+attribute+'"]').text();
  //     });

  //     return output;
  //   });

    
  // },

  serialize: function() {
    return {
      searchTerm: this.searchTerm
    };
  },

  afterRender: function() {
    this.setView('.ncbi-search-results-outlet', this.resultsView);
    this.$('form input[type="radio"][value="'+this.dbName+'"]').click();
  },

  enableFullscreen: function() {
    console.log("enableFullscreen");    
    //this.$(".ncbi-container").toggleClass("ncbi-fullscreen");
    //this.setView('.home-fullscreen', this);
    this.$el.addClass("fullscreen"); 
    $("#home-left-col").css("display","none");
    $(".home-open-file").css("display","none");
    $("#home-right-col").removeClass("col-md-6").addClass("col-md-12");
  },

  disableFullscreen: function() {
    this.$el.removeClass("fullscreen");
    $("#home-left-col").css("display","inline");
    $(".home-open-file").css("display", "inline");
    $("#home-right-col").removeClass("col-md-12").addClass("col-md-6");

  }

});

export default NCBIView;
