Object.assign = require('object-assign');
var gulp = require('gulp');
var sass = require('gulp-sass');
var rename = require('gulp-rename');
var cssGlobbing = require('gulp-css-globbing');
var bundleLogger = require('./utils/bundle_logger');
var cached = require('gulp-cached');
var remember = require('gulp-remember');
var path = require('path');
var fs = require('fs');
var _ = require('underscore');
var jsonSass = require('json-sass');
var source = require('vinyl-source-stream');
var autoprefixer = require('gulp-autoprefixer');
var sourcemaps = require('gulp-sourcemaps');
var minifyCss = require('gulp-minify-css');
var plumber = require('gulp-plumber');
var gzip = require('gulp-gzip');
var rev = require('gulp-rev');
var replace = require('gulp-replace');
var Q = require('q');

var isDev = global.isDev;

var filepath = './public/stylesheets/app.scss';
var filedir = path.dirname(filepath);

var themeJsonPath = './public/scripts/styles.json';
var themeScssDest = './';
var destPath = './public';

var sassOptions = {
  // includePaths: bourbon.includePaths,
  errLogToConsole: false,
};

var cssGlobbingOptions = {
  extensions: ['.css', '.scss']
};

var autoprefixerOptions = {
  browsers: [
    '> 1%', 
    'last 2 versions', 
    'Firefox ESR', 
    'Opera 12.1',
    'ie > 8'
  ],
  cascade: false
};


var autoprefixerOptionsDev = {
  browsers: [
    'last 1 version', 
  ],
  cascade: false
};

var run = function(watch, cb) {
  var target = filepath;

  if(watch) {
    bundleLogger.watch(target);
    bundleLogger.start(target);
  } else {
    bundleLogger.start(target);
  }

  var bundle = gulp.src(filepath, {base: './public'})
    .pipe(plumber({errorHandler: bundleLogger.error}))
    // .pipe(cached('stylesheets'))
    .pipe(cssGlobbing(cssGlobbingOptions));

  if(isDev) {
    bundle = bundle
      .pipe(sourcemaps.init())
      .pipe(sass(sassOptions))
      .pipe(autoprefixer(autoprefixerOptionsDev))
      .pipe(sourcemaps.write());
  } else {
    bundle = bundle
      .pipe(sass(sassOptions))
      .pipe(autoprefixer(autoprefixerOptions))
      .pipe(minifyCss());
  }

  bundle = bundle
    // .pipe(remember('stylesheets')) 
    .pipe(rename({ extname: '.css' }))
    .pipe(gulp.dest(destPath));

  if(!isDev) {
    bundle = bundle
      .pipe(rev())
      .pipe(gulp.dest(destPath)) 
      .pipe(gzip())
      .pipe(gulp.dest(destPath))
      .pipe(rev.manifest({merge: true}))
      .pipe(replace('.gz', ''))
      .pipe(replace('public/', ''))
      .pipe(gulp.dest(destPath + '../../')); 
  }

  return bundle
    .on('end', function() { 
      bundleLogger.end(target.replace('.scss', '.css')); 
      if(cb) cb();
    })
    .on('error', function(err) {
      bundleLogger.error(err);
      if(cb) cb(err);
    });
};

var buildTheme = function(cb) {
  bundleLogger.start(themeJsonPath);
  fs.createReadStream(themeJsonPath)
    .pipe(plumber())
    .pipe(jsonSass({
      prefix: '$shared-styles: ',
    }))
    .pipe(source(themeJsonPath))
    .pipe(rename({extname: '.scss'}))
    .on('error', function(err) {
      if(cb) cb(err);
    })
    .on('end', function() { 
      bundleLogger.end(themeJsonPath.replace('.json', '.scss'));
      if(cb) cb();
    })
    .pipe(gulp.dest(themeScssDest));
};

var runAndWatch = _.partial(buildTheme, _.partial(run, true));

gulp.task('theme', buildTheme);

gulp.task('css', function() { 
  var def = Q.defer();

  buildTheme(function(err) { 
    if(!err) {
      run(false, function() {
        def.resolve();
      });
    }
  }); 

  return def.promise;
});

gulp.task('css-only', function() { run(); });

gulp.task('css:watch', function() { 
  runAndWatch();

  gulp.watch('./public/scripts/styles.json', ['theme']);

  gulp.watch('./public/{stylesheets,scripts}/**/*.scss', ['css-only'])
    .on('change', function (event) {
      bundleLogger.rebuild(path.relative(filedir, event.path), filepath);
      if (event.type === 'deleted') {                  
        delete cached.caches.stylesheets[event.path];      
        remember.forget('stylesheets', event.path);        
      }
    });
});

