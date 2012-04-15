// TODO :
// ??? Maybe register API key for NCBI ajax access here : https://entrezajax.appspot.com/

/* Global variables :
* gentle (main.js)
* plugins (plugins.js)
*/

//________________________________________________________________________________________
// gentle object containing core methods
var gentle = {
	fileTypeList : [ 'fasta' , 'genebank' , 'plaintext' , 'sybil' ] ,
	features : {} , //{ 'note':'Note' , 'gene':'Gene' , 'cds':'CDS' , 'promoter':'Promoter' , 'misc':'Misc' , 'protein_bind':'Protein binding site' } ,
	sequences : [] ,
	current_sequence_entry : undefined ,
	main_sequence_canvas : undefined ,
	is_mobile : false ,

	init : function () {
	
		if(navigator.userAgent.match(/Android/i)) {
			gentle.is_mobile = true ;
		}
		if(navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPad/i)) {
			gentle.is_mobile = true ;
		}
		
		gentle.is_chrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
		
		window.onorientationchange = gentle.on_resize_event ;

		gentle.setMenuState ( 'edit_menu_undo' , false ) ;
		gentle.setMenuState ( 'edit_menu_redo' , false ) ;
		gentle.setMenuState ( 'edit_menu_cut' , false ) ;
		gentle.setMenuState ( 'edit_menu_copy' , false ) ;
		gentle.setMenuState ( 'edit_menu_paste' , false ) ;
		gentle.setMenuState ( 'edit_menu_annotate' , false ) ;

		plugins.init() ;
		if ( undefined === gentle_config ) {
			gentle_config = { default_plugins : [] , deactivated_plugins : [] } ;
		}
		
		gentle.dragEntered = 0 ;
		gentle.url_vars = {} ;
		gentle.url_vars = gentle.getUrlVars ( gentle.url_vars ) ;
		gentle.plugins = plugins ;
		loadBaseData() ;
		gentle.updateSequenceList() ;
	
		if (window.File && window.FileReader && window.FileList && window.Blob) {
		} else if ( gentle.is_mobile ) {
			// Ignore iOS restrictions
		} else if ( undefined !== getBlobBuilder() ) { // Otherwise, we have already warned...
			gentle.addAlert ( 'error' , "This browser does not support reading local files. Try current <a href='http://www.mozilla.org/en-US/firefox/new/'>FireFox</a>, <a href='https://www.google.com/chrome/'>Google Chrome</a>, or similar." ) ;
		}
	
		$(window).bind('beforeunload', function(){
		  gentle.saveLocally () ;
		});
		
		$('#main').height ( $('body').height()-50 ) ;
	
		$(window)
		.bind ( 'dragenter' , function ( evt ) {
			gentle.dragEntered++ ;
			if ( gentle.dragEntered == 1 ) $('#drop_zone').show() ;
		} )
		.bind ( 'dragleave' , function ( evt ) {
			gentle.dragEntered-- ;
			if ( gentle.dragEntered == 0 ) $('#drop_zone').hide() ;
		} ) ;
		
		$('#files').change ( gentle.handleFileSelect ) ;
		$('#drop_zone') .bind('dragover',function(evt){gentle.markDropArea(evt,true)})
						.bind('dragleave',function(evt){gentle.markDropArea(evt,false)})
						.bind('drop',gentle.handleFileDrop) ;
		
		gentle.loadLocally() ;
		plugins.loadPlugins() ;

		if ( gentle.sequences.length == 0 ) this.showDefaultBlurb() ;
		
		if ( gentle.url_vars.newsequence !== undefined ) gentle.startNewSequenceDialog() ;
	} ,
	
	getFeatureType : function ( s ) {
		var t = s.toLowerCase() ;
		if ( undefined === cd.feature_types[t] ) return 'misc' ;
		return t ;
	} ,
	
	addAlert : function ( type , message ) {
		var h = '<div class="alert alert-' + type + '">' ;
		h += '<a class="close" data-dismiss="alert">×</a>' ;
		h += message ;
		h += '</div>' ;
		$('#gentle_alerts').append ( h ) ;
	} ,
	
	showDefaultBlurb : function () {
		$("#main").load('public/templates/default_main.html', function(){
			$('#main_blurb').css ( { 'left' : $('#main').width()/4 } ) ;
			$('#main_blurb').width ( $('#main').width()/2 ) ;
			$('#main_blurb').height ( $('#main').height() ) ;
			$('#main_blurb').css ( { 'max-height' : $('#main').height() } ) ;
		});
	} ,
	
	loadLocally : function () {
		if ( !localStorage.getItem('saved') ) {
			gentle.loadLocalPlugins() ;
			return ;
		}

		// We cannot just assign the stored item, because of missing class methods
		// Each sequence object needs to be reconstructed individually
		var tmpseq = JSON.parse ( localStorage.getItem('sequences') ) ;
		gentle.sequences = [] ;
		$.each ( tmpseq , function ( k , v ) {
			if ( v.typeName == 'dna' ) {
				var seq = new SequenceDNA () ;
				seq.seedFrom ( v ) ;
				gentle.sequences[k] = seq ;
			} else if ( v.typeName == 'designer' ) {
				var seq = new SequenceDNA () ;
				seq.seedFrom ( v ) ;
				seq.typeName = 'designer' ;
				gentle.sequences[k] = seq ;
			} else {
				console.log ( 'UNKNOWN LOCAL STORAGE SEQUENCE TYPENAME ' + v.typeName ) ;
			}
		} ) ;
		
		// Now show last sequence, if any
		gentle.current_sequence_entry === undefined ;

		if ( gentle.sequences.length > 0 ) {
			gentle.updateSequenceList() ;
			gentle.showSequence ( localStorage.getItem('last_entry') ) ;
		}
		
		gentle.loadLocalPlugins() ;
	} ,
	
	loadLocalPlugins : function () {
		var plugin_list = localStorage.getItem('plugin_lists') ;
		if ( plugin_list ) {
			plugin_list = JSON.parse ( plugin_list ) ;
			plugins.load_on_start = gentle_config.default_plugins ;
			$.each ( plugin_list.all , function ( k , v ) { plugins.load_on_start.push ( k ) ; } ) ;
			plugins.load_on_start = jQuery.unique ( plugins.load_on_start ) ;
			plugins.deactivated = plugin_list.deactivated ;
			plugins.loadPlugins() ;
		} else {
			plugins.load_on_start = gentle_config.default_plugins ;
		}
	} ,

	saveLocally : function () {
		gentle.updateCurrentSequenceSettings () ;
		if ( gentle.sequences.length == 0 ) {
			gentle.clearLocalStorage () ;
			return ;
		}
		
		var tmp = [] ;
		$.each ( gentle.sequences , function ( k , v ) {
			tmp[k] = v.getStorageObject() ;
		} ) ;

		var s = JSON.stringify ( tmp ) ; // gentle.sequences
		try {
			localStorage.setItem ( 'sequences' , s ) ;
		}  catch (e) {
			alert ( 'Local storage quota exceeded. Changes since last page load will not be stored. Sorry about that.' ) ;
			return ;
		}
		localStorage.setItem ( 'last_entry' , gentle.current_sequence_entry ) ;
		localStorage.setItem ( 'saved' , 'true' ) ;
		
		var plugin_list = { all : {} , deactivated : {} } ;
		$.each ( plugins.all , function ( k , v ) {
			if ( v.url !== undefined ) plugin_list.all[v.url] = true;
		} ) ;
		$.each ( plugins.deactivated , function ( k , v ) {
			plugin_list.deactivated[k] = true;
		} ) ;
		localStorage.setItem ( 'plugin_lists' , JSON.stringify(plugin_list) ) ;
	} ,
	
	setMenuState : function ( id , state ) {
		if ( state ) {
			$('#'+id).removeClass ( 'disabled btn-disabled' ) ;
			$('#'+id).show() ;
		} else {
			$('#'+id).addClass ( 'disabled btn-disabled' ) ;
			$('#'+id).hide() ;
		}
		
		// Show/hide entire edit menu
		var show_edit_menu = $('#edit_menu ul a:not(.disabled)').length ;
		if ( show_edit_menu > 0 ) $('#edit_menu').show() ;
		else $('#edit_menu').hide() ;
	} ,

	do_annotate : function () {
		var sc = gentle.main_sequence_canvas ;
		if ( sc === undefined ) return false ;
		if ( sc.selections.length == 0 ) return ;
		
		// This should probably get its own file...
		
		function submitTask () {
			var ann = {
				'_type' : $('#aad_type').val() ,
				'_range' : [ { from:$('#aad_from').text()*1-1 , to:$('#aad_to').text()*1-1 } ] ,
				'name' : $('#aad_name').val() ,
				'desc' : $('#aad_desc').val()
			} ;

			sc.sequence.features.push ( ann ) ;
			sc.recalc() ;
			sc.show () ;
			top_display.init() ;
			$('#aad_annotation_dialog').modal('hide');
			$('#aad_annotation_dialog').remove();
		}
		
		$('#aad_annotation_dialog').remove() ;
		var dialogContainer = $("<div/>");
		dialogContainer.load("public/templates/aad_annotation_dialog.html", function(){
			dialogContainer.appendTo("#all");
			$('#aad_annotation_dialog').modal();
			
			$('#aad_from').text ( sc.selections[0].from+1 ) ;
			$('#aad_to').text ( sc.selections[0].to+1 ) ;
			
			$.each ( gentle.features , function ( k , v ) {
				var s = "<option value='"+k+"'" ;
				if ( k == 'note' ) s += " selected" ;
				s += ">"+v+"</option>" ;
				$('#aad_type').append ( s ) ;
			} ) ;
			
			$('#aad_name').focus() ;
			
			$("#aad_annotation_form input[type=submit]").click(function(){submitTask();});
			$("#aad_name").keypress(function(e) { if(e.keyCode === 13) submitTask(); });
		});
		
		
		return false ;
	} ,

	do_edit : function ( command ) {
		if ( gentle.main_sequence_canvas === undefined ) return false ;

		var sc = gentle.main_sequence_canvas ;

		var s = '' ;
		var title = 'Copy/paste area' ;
		if ( command == 'cut' || command == 'copy' ) {
			s = gentle.main_sequence_canvas.cut_copy ( (command=='cut') ) ;
		} else if ( command == 'paste' ) {
			if ( !sc.edit.editing ) return false ; // Edit mode only
		} else {
			console.log ( "Unknown command " + command + " in gentle.do_edit" ) ;
			return false ;
		}

		$('#ccp_dialog').remove() ;

		var h = '' ;
		h += '<div class="modal" id="ccp_dialog" style="display:none">' ;
		h += '<div class="modal-header">' ;
		h += '<a class="close" data-dismiss="modal">×</a>' ;
		h += '<h3>' + title + '</h3>' ;
		h += '</div>' ;
		h += '<div class="modal-body">' ;
		h += '<textarea id="paste_area" cols=60 rows=5 style="width:100%">' + s + '</textarea>' ;
		if ( command == 'paste' ) h += '<input type="button" id="ccp_dialog_doit" value="Paste" />' ;
		h += '</div>' ;
		if ( !gentle.is_mobile ) {
			h += '<div class="modal-footer">' ;
			h += "<i>You can also use keyboard shortcuts for cut, copy, and paste without this dialog!</i>" ;
			h += '</div>' ;
		}
		h += '</div>' ;
		$('#all').append ( h ) ;
		$('#ccp_dialog').modal() ;
		$('#ccp_dialog').on('hidden' , function () {
			sc.bindKeyboard() ;
		} ) ;
		$('#paste_area').focus() ;
		$('#paste_area').select() ;
		
		$(document).off ( 'copy keydown paste cut' ) ;
		
		if ( command == 'paste' ) {
			$('#ccp_dialog_doit').click ( function () {
				var text = $('#paste_area').val() ;
				var sc = gentle.main_sequence_canvas ;
				$('#ccp_dialog').modal('hide') ;
				$('#ccp_dialog').remove() ;
				sc.doCheckedPaste ( sc , text ) ;
				return false ;
			} ) ;
		}

		return false ;
	} ,
	
	startNewSequenceDialog : function () {
	  $('#newSequenceDialog').remove() ;
	   function submitTask () {
	/*     var ncbiID = $('#ncbi_form input[name=ncbiID]').val();
		 //TODO: better check for ncbi codes, better way to deal with user errors.
		 if (ncbiID !== "") {
		   $('#nbci_form').html("<i>Querying NCBI...</i>");
		   new_sequence_from_textarea(ncbiID);
		 } else {
		   alert("Bad ID provided");
		 }*/
	  }
	
	  var dialogContainer = $("<div/>");
	  dialogContainer.load("public/templates/new_sequence_dialog.html", function(){
		dialogContainer.appendTo("#all");
		$('#newSequenceDialog').modal();
		$('#new_sequence_entry').focus() ;
	//    $("#ncbi_form input[type=submit]").click(function(){submitTask();});
	  });
	} ,
	
	createNewSequenceFromDialog : function () {
		var text = $("#new_sequence_entry").val() ;
		
		if ( text == '' ) {
			alert ( "In Soviet Russia, empty text parses YOU!" ) ;
			return ;
		}

		// Determine file type
		var found = false ;
		$.each ( gentle.fileTypeList , function ( k , v ) {
			var file = new window['FT_'+v]();
			if ( file.checkText ( text ) ) { // End filetype search
				found = true ;
				return false ;
			}
		} ) ;
		
		if ( found ) {
			$("#newSequenceDialog").modal("hide").remove();
		} else {
			alert ( "File type not recognised" ) ;
		}
	} ,

	closeAllSequences : function () {
		while ( gentle.sequences.length > 0 ) {
			gentle.closeSequence ( 0 ) ;
		}
	} ,

	closeCurrentSequence : function () {
		gentle.closeSequence ( gentle.current_sequence_entry ) ;
	} ,
	
	closeSequence : function ( entry ) {
		if ( entry === undefined ) return ;
		
		gentle.sequences.splice ( entry , 1 ) ;
		gentle.updateSequenceList() ;
		
		if ( gentle.sequences.length == 0 ) {
			gentle.current_sequence_entry = undefined ;
			gentle.clearLocalStorage () ;
			$('#close_sequence').hide() ;
			$('#topbox').html ( '' ) ;
			$('#main').html ( '' ) ;
			$('#sb_display_options').html ( '' ) ;
			$('#position').html ( '&nbsp;' ) ;
//			$('#right').html ( '' ) ;
			$('#toolbar_ul .toolbar_plugin').remove() ;
			gentle.showDefaultBlurb() ;
			return ;
		}
		
		if ( entry == gentle.current_sequence_entry ) gentle.current_sequence_entry = gentle.current_sequence_entry - 1 ;
		else if ( entry < gentle.current_sequence_entry ) gentle.current_sequence_entry-- ;
		if ( gentle.current_sequence_entry < 0 ) gentle.current_sequence_entry = 0 ;
		gentle.showSequence ( gentle.current_sequence_entry ) ;
	} ,
	
	clearLocalStorage : function () {
//		localStorage.clear() ; // Don't use, would nuke plugins
		localStorage.removeItem('saved') ;
		localStorage.removeItem('last_entry') ;
		localStorage.removeItem('sequences') ;
	} ,
	
	updateCurrentSequenceSettings : function () {
		if ( gentle.current_sequence_entry === undefined ) return ;
		gentle.sequences[gentle.current_sequence_entry].settings = gentle.main_sequence_canvas.getSettings() ;
	//	console.log ( "STORING : " + JSON.stringify ( gentle.sequences[gentle.current_sequence_entry].settings ) ) ;
	} ,
	
	handleSelectSequenceEntry : function ( entry ) {
		gentle.updateCurrentSequenceSettings () ;
		$('#close_sequence').show() ;
		
		var sc = gentle.sequences[entry] ;
		
		if ( sc.typeName == 'designer' ) gentle.handleSelectSequenceEntryDesigner ( entry ) ;
		else gentle.handleSelectSequenceEntryDNA ( entry ) ; // Default
	} ,

	handleSelectSequenceEntryDesigner : function ( entry ) {
		gentle.current_sequence_entry = entry ;
		var html = "<div id='canvas_wrapper'>" ;
		html += "</div>" ;
		$('#main').html ( html ) ;

		// Set up new top display
		$('#top_zone').html('');
		top_display = undefined ;
		
		// Set up new sequence canvas
		gentle.main_sequence_canvas = new SequenceCanvasDesigner ( gentle.sequences[entry] , 'sequence_canvas' ) ;
		if ( $('#topbox').is(':visible') ) gentle.toggle_right_sidebar();
	} ,
		
	handleSelectSequenceEntryDNA : function ( entry ) {
		gentle.current_sequence_entry = entry ;
		
		var html = "<div id='canvas_wrapper'>" ;
		html += "<canvas id='sequence_canvas'></canvas>" ;
		html += "<div id='main_slider'></div>" ;
		html += "</div>" ;
		$('#main').html ( html ) ;
		if ( !gentle.is_mobile && !gentle.is_chrome ) $('#canvas_wrapper').attr ( 'contenteditable' , 'true' ) ;
		
		$('#canvas_wrapper').height ( $('#main').height() - 20 ) ;
		
		// Set up new top display
		top_display = new TopDisplayDNA ( true ) ;
		top_display.init() ;
		
		// Set up new sequence canvas
		gentle.main_sequence_canvas = new SequenceCanvasDNA ( gentle.sequences[entry] , 'sequence_canvas' ) ;
	
	} ,

	getUrlVars : function ( def ) {
		var vars = def , hash;
		var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
		$.each ( hashes , function ( i , j ) {
			var hash = j.split('=');
			hash[1] += '' ;
			vars[hash[0]] = decodeURI(hash[1]).replace(/_/g,' ');
		} ) ;
		return vars;
	} ,
		

	// File open/drop handlers
	handleFileSelect : function ( evt ) {
		$.each ( evt.target.files , function ( k , f ) { gentle.addLocalFile ( f ) } ) ;
	} ,
	
	handleFileDrop : function (evt) {
		gentle.dragEntered = 0 ;
		evt.originalEvent.stopPropagation();
		evt.originalEvent.preventDefault();
		$.each ( evt.originalEvent.dataTransfer.files , function ( k , f ) { gentle.addLocalFile ( f ) } ) ;
		gentle.markDropArea(evt,false);
		$('#drop_zone').hide() ;
	} ,
	
	markDropArea : function ( evt , mode ) {
		evt.originalEvent.stopPropagation();
		evt.originalEvent.preventDefault();
		evt.originalEvent.dataTransfer.dropEffect = 'copy';
		$('#drop_zone').css({'background-color':(mode?'#CCCCCC':'white')}) ;
	} ,
	
	fileLoaded : function ( f ) {
//		$('#sb_log').append ( '<p>' + f.file.name + ' is ' + f.typeName + '</p>' ) ;
	} ,
	
	addLocalFile : function ( f ) {
//		$('#sb_log').append ( '<p>Loading ' + f.name + '</p>' ) ;
		
		// Determine file type
		f.isIdentified = false ;
		
		$.each ( gentle.fileTypeList , function ( k , v ) {
			var file = new window['FT_'+v]();
			file.checkFile ( f ) ;
		} ) ;
	
	} ,
	
	toggle_display_settings : function () {
		if ( $('#sb_display_options').is(':visible') ) {
			$('#sb_display_options').dialog ( 'close' ) ;
		} else {
			$('#sb_display_options').dialog ( { modal : false , width : 'auto' } ) ;
	 		$('#sb_display_options').dialog('option', 'position', 'center');
		}
	} ,
	
	toggle_loaded_sequences : function () {
		if ( $('#sb_sequences_container').is(':visible') ) {
			$('#sb_sequences_container').dialog ( 'close' ) ;
		} else {
			$('#sb_sequences_container').dialog ( { modal:false , width:'auto' , maxWidth:1200 , height:'auto' } ) ;
		}
	} ,
	
	toggle_right_sidebar : function () {
		var sc = gentle.main_sequence_canvas ;
		if ( $('#topbox').is(':visible') ) {
			$('#topbox').hide() ;
			sc.tbw = $('#canvas_wrapper').css('right');
			$('#canvas_wrapper').css ( { right : 0 } ) ;
		} else {
			$('#canvas_wrapper').css ( { right : sc.tbw } ) ;
			$('#topbox').show() ;
		}
		gentle.on_resize_event() ;
		$('#right_sidebar_icon').toggleClass('icon-chevron-right').toggleClass('icon-chevron-left') ;
		$('#zoombox').toggle ( $('#topbox').is(':visible') ) ;
	} ,
	
	delete_selection : function () {
		var sc = gentle.main_sequence_canvas ;
		sc.deleteSelection();
	} ,
	
	startDesigner : function () {
		var use_existing ;
		$.each ( gentle.sequences , function ( k , v ) {
			if ( v.typeName == 'designer' ) use_existing = k ;
		} ) ;
		if ( undefined != use_existing ) {
			gentle.handleSelectSequenceEntry ( use_existing ) ;
			return ;
		}
		
		// Start new designed
		var entry = gentle.sequences.length ;
		var seq = gentle.sequences[gentle.current_sequence_entry].clone() ;
		seq.typeName = 'designer' ;
		gentle.addSequence ( seq , true ) ;
	} ,
	
	/* BEGIN Loaded sequences dialog functions */
	
	addSequence : function ( sequence , show ) {
		var seqid = gentle.sequences.length ;
		gentle.sequences.push ( sequence ) ;
		gentle.updateSequenceList () ;
		if ( show ) gentle.showSequence ( seqid ) ;
		return seqid ;
	} ,
	
	showSequence : function ( seqid ) {
		seqid = parseInt ( seqid ) ; // Paranoia
		gentle.handleSelectSequenceEntry ( seqid ) ;
		$('.loaded_sequence_select_icon').hide() ;
		$('#loaded_sequence_select_icon'+seqid).show() ;
	} ,

	updateSequenceList : function () {
		var h = "<table class='table table-condensed'>" ;
		h += "<thead><tr><th>&nbsp;</th><th>Type</th><th>Sequence</th><th>Action</th></tr></thead><tbody>" ;
		$.each ( gentle.sequences , function ( seqid , seq ) {
			var show_title = seq.name ;
			var show_type = seq.typeName ;
			if ( show_type == 'dna' ) show_type = show_type.toUpperCase() ;
			else show_type = ucFirst ( show_type ) ;
			h += "<tr onclick='gentle.showSequence(" + seqid + ");return false' style='cursor:pointer'><td>" ;
			h += "<i class='icon-chevron-right loaded_sequence_select_icon' id='loaded_sequence_select_icon" + seqid + "'></i>" ;
			h += "</td><td>" ;
			h += show_type ;
			h += "</td><td>" ;
			h += show_title ;
			h += "</td><td>" ;
			h += "<button class='btn btn-danger' onclick='gentle.closeSequence(" + seqid + ")'>Delete</button>" ;
			h += "</td></tr>" ;
		} ) ;
		h += "</tbody></table>" ;
		h += "<hr/><div style='text-align:right'><button class='btn btn-danger' onclick='gentle.closeAllSequences()'>Delete all</button></div>" ;

		if ( gentle.sequences.length == 0 ) {
			h = "<i>No sequences loaded</i>" ;
		}

		$('#sb_sequences_table_container').html ( h ) ;
		$('.loaded_sequence_select_icon').hide() ;
		if ( undefined !== gentle.current_sequence_entry && gentle.current_sequence_entry < gentle.sequences.length ) {
			$('#loaded_sequence_select_icon'+gentle.current_sequence_entry).show() ;
		}
		$( "sb_sequences_container" ).dialog( "option", "position", 'center' );
	} ,

	/* END Loaded sequences dialog functions */
	
	
	
	sequence_info : function () {
		var sc = gentle.main_sequence_canvas ;
		if ( undefined === sc ) return ;
		
		gentle.sequence_info_dialog = new SequenceInfoDialogDNA ( sc ) ; // FIXME hardcoded for DNA
	} ,
	
	set_hover : function ( html ) {
		$('#hoverbox').html ( html ) ;
	} ,
	
	doUndo : function () {
		var sc = gentle.main_sequence_canvas ;
		if ( undefined === sc ) return false ;
		if ( undefined === sc.sequence.undo ) return false ;
		sc.sequence.undo.doUndo ( sc ) ;
		return false ;
	} ,
	
	doRedo : function () {
		var sc = gentle.main_sequence_canvas ;
		if ( undefined === sc ) return false ;
		if ( undefined === sc.sequence.undo ) return false ;
		sc.sequence.undo.doRedo ( sc ) ;
		return false ;
	} ,
	
	on_resize_event : function () {
		gentle.main_sequence_canvas.resizeCanvas() ;
	}

} ;


//________________________________________________________________________________________
// Init when page has loaded
$(document).ready ( function () {
	gentle.init () ;
} ) ;

// Hide URL bar in most mobile browsers
window.addEventListener("load",function() { setTimeout(function(){window.scrollTo(0, 1);}, 0); });
