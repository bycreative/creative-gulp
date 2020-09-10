'use strict';

/* ----------------------------------------------------------------
// Основные задачи GULP
	gulp dev   - Сборка проекта и слежение за изминениями
	gulp build - Сборка проекта
	gulp serve - Запуск Browsersync

	Название отдельных команд - далее по файлу.

// Параметры командной строки
	--production    - Включить режим сборки на production
	--tinypng       - Включить сжатие изображений сервисом Tinypng
	--sourcemaps    - Включить генерацию sourcemaps
	--html-injector - Обновление html без перезагрузки (проблемный)
/* ---------------------------------------------------------------*/

// ----------------------------------------------------------------
// Plugins
// ----------------------------------------------------------------
const gulp         = require('gulp');
const del          = require('del');
const _if          = require('gulp-if');
const pipe         = require('multipipe');
const gutil        = require('gulp-util');
const debug        = require('gulp-debug');
const cache        = require('gulp-cached');
const fileinclude  = require('gulp-file-include');
const notify       = require('gulp-notify');
const postcss      = require('gulp-postcss');
const sass         = require('gulp-sass');
const less         = require('gulp-less');
const stylus       = require('gulp-stylus');
const bulkSass     = require('gulp-sass-glob-import');
const sassComments = require('gulp-sass-import-comment');
const sassVars     = require('gulp-sass-vars');
const mmq          = require('gulp-merge-media-queries');
const cleanCSS     = require('gulp-clean-css');
const replace      = require('gulp-replace');
const pug          = require('gulp-pug');
const htmlcomb     = require('gulp-htmlcomb');
const htmlbeautify = require('gulp-html-beautify');
const inky         = require('inky');
const inlineSource = require('gulp-inline-source');
const inlineCSS    = require('gulp-inline-css');
const uglify       = require('gulp-uglify');
const babel        = require('gulp-babel');
const coffee       = require('gulp-coffee');
const browserify   = require('gulp-browserify');
const tap          = require('gulp-tap');
const stripDebug   = require('gulp-strip-debug');
const prettify     = require('gulp-jsbeautifier');
const tinypng      = require('gulp-tinypng-compress');
const imagemin     = require('gulp-imagemin');
const filter       = require('gulp-filter');
const webp         = require('gulp-webp');
const minSVG       = require('gulp-svgmin');
const spriteSVG    = require('gulp-svg-sprite');
const zip          = require('gulp-zip');
const hash         = require('gulp-hash-filename');
const browserSync  = require('browser-sync').create();
const mail         = require('gulp-mail');
const sourcemaps   = require('gulp-sourcemaps');

// ----------------------------------------------------------------
// Config
// ----------------------------------------------------------------
const config = {
	// Домен
	host: 'html',

	// Слеши обязательны
	path: 'C:/www/domains/html/',

	backup: 'D:/backup/',

	production: (gutil.env['production'] ? true : false),

	sourcemaps: (gutil.env['sourcemaps'] ? true: false),

	htmlInjector: (gutil.env['html-injector'] ? true: false),

	plugins: {
		minify: {
			// Файлы которые НЕ следует минифицировать
			exclude: ['template.css', 'template.js'],
		},
		cache: {
			// Файлы которые НЕ следует кэшировать
			exclude: ['template.scss', 'template.js', 'components.js'],
		},
		browserify: {
			// Файлы в которых задействован browserify
			include: ['components.js'],
			//include: [],
		},
		babel: {
			// Файлы в которых задействован babel
			include: ['template.js', 'components.js'],
		},
		tinypng: {
			// Формат файлов которые следует минифицировать
			include: /\.(jpe?g|png)/i,
			enable: (gutil.env['tinypng']),
			apikey: [
				'dv3eVZOvPbJ2YDcVOk35VFY5zma_LDYt',
				'GjeydoNR2QWj4y6uINvnpku7TAoVuRgK',
				'VvfEoKfyFpNtyJeRLATc6ZqQcoZnvgOE',
			],
		},
		mail: {
			subject: 'gulp test mail',
			to: [
				'test@yandex.ru',
			],
			from: 'Gulp «4» <from4@yandex.ru>',
			smtp: {
				auth: {
					user: 'from4@yandex.ru',
					pass: '123'
				},
				host: 'smtp.yandex.ru',
				secureConnection: true,
				port: 465
			}
		}
	}
};

//process.env.NODE_ENV = config.production ? 'production' : 'development';
process.env.NODE_ENV = 'production';

// ----------------------------------------------------------------
// Paths
// ----------------------------------------------------------------
const path = {
	src: config.path + 'src/',

	dest: config.path + 'assets/',

	tmp: config.path + 'tmp/',

	vendor: './node_modules/',

	config: config.path + 'src/config.js',

	add: function(paths) {
		for (let task in paths) {
			this[task] = {};

			let libs = tplConfig.vendor;

			if (typeof libs[task] === 'object') {
				this[task].src = libs[task].map(vendor).concat(paths[task][0]);
			} else {
				this[task].src = paths[task][0];
			}

			this[task].dest = paths[task][1] || this.dest;
			this[task].watch = paths[task][2] || this[task].src;
		}
	}
};

// ----------------------------------------------------------------
// Template config
// ----------------------------------------------------------------
const tplConfig = require(path.config);
tplConfig.production = config.production;

// Shortcodes for path
const src = function(glob) {
	return path.src.concat(glob);
};

const dest = function(glob) {
	return path.dest.concat(glob);
};

const tmp = function(glob) {
	return path.tmp.concat(glob);
};

const vendor = function(glob) {
	return path.vendor.concat(glob);
}

// Project source paths
path.add({
	css: [
		[src('css/*.*')],
		dest('css'),
		[src('css/**/*.*')]
	],
	js: [
		[src('js/*.*')],
		dest('js'),
		[src('js/**/*.*')]
	],
	html: [
		[src('html/*.pug')],
		path.dest,
		[src('html/**/*.*')]
	],
	email: [
		[src('email/*.pug')],
		dest('email'),
		[src('email/*.pug'), dest('css/email.css')],
	],
	sprite: [
		[src('img/sprite/**/*.svg')],
		dest('img')
	],
	img: [
		[src('img/**/*.*'), `!${src('img/sprite/**/*.*')}`],
		dest('img')
	],
	fonts: [
		[src('fonts/**/*.*')],
		dest('fonts')
	]
});

// ----------------------------------------------------------------
// Condition: Minify
// ----------------------------------------------------------------
const doMinify = function (file) {
	return (config.production && config.plugins.minify.exclude.indexOf(file.basename) < 0);
}

// ----------------------------------------------------------------
// Condition: Cache
// ----------------------------------------------------------------
const doCache = function (file) {
	return (config.plugins.cache.exclude.indexOf(file.basename) < 0);
}

// ----------------------------------------------------------------
// Log: error
// ----------------------------------------------------------------
const errorLog = function(error) {
	gutil.log(error);
	gutil.beep();
	notify.onError({
		title: error.plugin,
		sound: false,
		wait: false,
		onLast: true
	})(error);
	browserSync.sockets.emit('fullscreen:message', {
		 title: error.plugin,
		 body: error.message,
		 timeout: 10e10,
		 titleStyles: '" class="browsersync-fulltitle',
		 wrapperStyles: '" class="browsersync-fullmsg'
	});
	this.emit('end');
}

const clearLog = function() {
	browserSync.sockets.emit('fullscreen:message:clear')
};

// ----------------------------------------------------------------
// Task: CSS
// ----------------------------------------------------------------
gulp.task('css', function() {
	const isSass = file => /\.s[ac]ss$/i.test(file.extname);
	const isLess = file => /\.less$/i.test(file.extname);
	const isStyl = file => /\.styl(us)?$/i.test(file.extname);

	var postCssPlugins = [
		require('postcss-flexbugs-fixes'),
		require('postcss-assets'),
		require('postcss-custom-properties')({
			preserve: !config.production,
		}),
		require('postcss-easysprites')({
			imagePath: path.img.dest,
			spritePath: path.img.dest
		}),
		require('postcss-focus'),
		require('autoprefixer')({grid: 'autoplace', overrideBrowserslist: ['> 0.3%', 'ie 8-11']})
	];

	if (config.production) {
		postCssPlugins = postCssPlugins.concat([
			require('postcss-sorting')({
				'properties-order': 'alphabetical'
			}),
			require('postcss-cachebuster')
		]);
	}

	return pipe(
		gulp.src(path.css.src),
		_if(doCache, cache('css')),
		debug({title: 'css'}),
		_if(isSass,
			pipe(
				  sassVars({config: tplConfig}, {verbose: false}),
				  bulkSass(),
				  sassComments({
						exclude: /(mixins|functions|variables)/i
				  }),
				  sourcemaps.init(),
				  sass({
						includePaths: [path.vendor]
				 })
			)
		),
		_if(isLess, less()),
		_if(isStyl, stylus()),
		postcss(postCssPlugins),

		/* Костыль для исправления путей к ресурсам импортированных библиотек,
			в частности: fancybox, jquery-ui
			Возможны побочные баги в путях. */
		replace(/url\(.+\)/gi, function(match) {
			let url = match.replace(/['"]/g, '');

			if (url.match(/\.(jpe?g|png|gif|webp)/i)) {
				url.replace(/url\((img|images)\)/i, '../img');
				url.replace('../assets/', '');
				if(url.indexOf('url(../img/') < 0) url = url.replace(/url\(/gi, 'url(../img/');

				url = url.replace('(', '("');
				url = url.replace(')', '")');

				match = url;
			}
			return match;
		}),

		_if(config.production,
			 pipe(
				mmq(),
				_if(doMinify,
					cleanCSS({level: {1: {specialComments: 0}}}),
					pipe(
						cleanCSS({level: {1: {}, 2: {all: false, mergeIntoShorthands: true, removeEmpty: true, removeDuplicateRules: true,}}}),
						prettify({indent_with_tabs: true})
					)
				),
			),
		),
		sourcemaps.write('./'),
		gulp.dest(path.css.dest)
	).on('error', errorLog)
	.on('data', clearLog);
});

// ----------------------------------------------------------------
// Task: JS
// ----------------------------------------------------------------
gulp.task('js', function() {
	const doBrowserify = file => {
		return config.plugins.browserify.include.indexOf(file.basename) >= 0
	};

	const doCoffee = file => {
		return file.extname == '.coffee';
	};

	const doBabel = file => {
		return config.plugins.babel.include.indexOf(file.basename) >= 0
	};

	return pipe(
		gulp.src(path.js.src),
		_if(doCache, cache('js')),
		debug({title: 'js'}),
		fileinclude({prefix: '@libs', basepath: path.vendor}),
		fileinclude({prefix: '@file', basepath: src('js')}),
		_if(doCoffee,
			 coffee({bare: true})
		),
		_if(doBrowserify,
			 browserify({
				debug: false,
				paths: [path.vendor, src('js/components')],
				extensions: ['.js', '.vue'],
				transform: [
					[
						{
							/*
								Костыль для автоматизации подключения
								миксинов bemto в шаблонах Vue
							*/
							replace: [{
								from: "<template lang='pug'>",
								to: "<template lang='pug'>\r\n\tinclude /bemto.pug/bemto"
							}]
						},
						require('browserify-replace'),
					],
					[
						{
							_flags: {debug: false},
							babel: {
								/*
									Пропускаем встроенный обработчик babel в vueify
								*/
								ignore: ['*'],
							},
							pug: {
								basedir: path.vendor
							},
						},
						require('vueify'),
					]
				]
			 })
		),
		_if(doBabel,
			 pipe(
				 babel({
					presets: [
						[
							require('babel-preset-env'),
							{
								targets: {
									browsers: ['ie >= 9'],
									uglify: true
								}
							}
						],
						[
							require('babel-preset-stage-3')
						],
					],
					sourceMaps: false,
				 }),
				 /*
					При трансформации `${строк-шаблонов}` babel сохраняет символы
					переноса строк и табуляции, удаляем их.
				 */
				 tap(function(file) {
					let contents = file.contents.toString();
					contents = contents.replace(/\\([tnr])/g, '');
					file.contents = Buffer.from(contents, 'utf8');
				 })
			)
		),
		_if(config.production,
			pipe(
				stripDebug(),
				_if(doMinify,
					uglify(),
					prettify({indent_with_tabs: true})
				),
			)
		),
		gulp.dest(path.js.dest)
	).on('error', errorLog)
	.on('data', clearLog);
});

// ----------------------------------------------------------------
// Task: HTML
// ----------------------------------------------------------------
gulp.task('html', function() {
	const vars = require(path.config);
	vars.production = config.production;

	return pipe(
		gulp.src(path.html.src),
		debug({title: 'html'}),
		pug({
			basedir: path.vendor,
			pretty: '\t',
			cache: true,
			data: {
				config: tplConfig
			},
		}),
		htmlcomb(),
		htmlbeautify({
			indentSize: 1,
			indentWithTabs: true,
			inline: ['br', 'span'],
		}),
		tap(function(file) {
			let contents = file.contents.toString();
			contents = contents.replace(/^\s*[\r\n]/gm, "\r\n");
			file.contents = Buffer.from(contents, 'utf8');
		 }),
		gulp.dest(path.html.dest)
	).on('error', errorLog)
	.on('data', clearLog);
});

// ----------------------------------------------------------------
// Task: Img
// ----------------------------------------------------------------
gulp.task('img', function() {
	const doTinypng = file => {
		if (config.plugins.tinypng.enable && config.plugins.tinypng.apikey) {
			return config.plugins.tinypng.include.test(file.extname);
		}
	};

	return pipe(
		gulp.src(path.img.src, {since: gulp.lastRun('img')}),
		_if(doTinypng,
			pipe(
				tinypng({
					key: config.plugins.tinypng.apikey[Math.floor(Math.random() * (config.plugins.tinypng.apikey.length - 1))],
					summarize: true
				})
			)
		),
		_if(config.production, imagemin()),
		gulp.dest(path.img.dest),
		filter(['**/*.{jpeg,jpg,png}']),
		webp(),
		gulp.dest(path.img.dest + '/webp/')
	).on('error', errorLog);
});

// ----------------------------------------------------------------
// Task: Sprite
// ----------------------------------------------------------------
gulp.task('sprite', function() {
	return pipe(
		gulp.src(path.sprite.src),
		debug({title: 'sprite'}),
		minSVG(),
		spriteSVG({
			transform: ['svgo'],
			mode: {
				symbol: {
					dest: '',
					sprite: 'sprite.svg'
				}
			}
		}),
		gulp.dest(path.sprite.dest)
	).on('error', errorLog);
});

// ----------------------------------------------------------------
// Task: Fonts
// ----------------------------------------------------------------
gulp.task('fonts', function() {
	return pipe(
		gulp.src(path.fonts.src),
		gulp.dest(path.fonts.dest)
	).on('error', errorLog);
});

// ----------------------------------------------------------------
// Task: Inky
// ----------------------------------------------------------------
gulp.task('inky', function() {
	return pipe(
		gulp.src(path.email.src),
		debug({title: 'inky'}),
		pug({
			basedir: path.vendor,
			pretty: '\t',
			cache: true,
		}),
		inky(),
		htmlcomb(),
		inlineSource(),
		inlineCSS({
			preserveMediaQueries: true
		}),
		gulp.dest(path.email.dest),
		browserSync.stream()
	).on('error', errorLog)
	.on('data', clearLog);
});

// ----------------------------------------------------------------
// Task: Email
// ----------------------------------------------------------------
gulp.task('email', function () {
	return pipe(
      gulp.src(dest('email/index.html')),
      debug({title: 'email'}),
      mail(config.plugins.mail)
	);
});

// ----------------------------------------------------------------
// Task: Serve
// ----------------------------------------------------------------
gulp.task('serve', function() {
	let options = {
		proxy: config.host,
		ui: false,
		open: false,
		notify: false,
		ghostMode: false,
		online: true,
		files: [path.dest],
		plugins: [{
			module: 'bs-fullscreen-message'
		}],
		snippetOptions: {
		    rule: {
		        match: /<\/head>/i,
		        fn: function (snippet, match) {
		            return `
	<link rel="stylesheet" href="/css/debug.css">
	<script src="/js/debug.js"></script>
	${snippet} ${match}`;
		        }
		    }
		}
	};

	if (config.htmlInjector) {
		options.files = [dest('**/*.!(html|map)')],
		options.plugins = [{
			module: 'bs-html-injector',
			options: {
				files: [dest('*.html')]
			}
		}];
	}

	browserSync.init(options);
});

// ----------------------------------------------------------------
// Task: Watch
// ----------------------------------------------------------------
gulp.task('watch', function() {
	gulp.watch(path.css.watch, gulp.series('css'));
	gulp.watch(path.js.watch, gulp.series('js'));
	gulp.watch(path.html.watch, gulp.series('html'));
	gulp.watch(path.img.watch, gulp.series('img'));
	gulp.watch(path.sprite.watch, gulp.series('sprite'));
	//gulp.watch(path.fonts.watch, gulp.series('fonts'));
	//gulp.watch(path.email.watch, gulp.series('inky'));
});

// ----------------------------------------------------------------
// Task: Backup
// ----------------------------------------------------------------
gulp.task('backup', function() {
	return pipe(
		gulp.src(config.path + '**/*'),
		zip('backup.zip'),
		hash({
			format: '{hash}{ext}'
		}),
		gulp.dest(config.backup + '/' + config.host),
		debug({title: 'backup'})
	).on('error', errorLog);
});

// ----------------------------------------------------------------
// Task: Clean
// ----------------------------------------------------------------
gulp.task('clean', function() {
	gutil.log('clean ' + gutil.colors.blue(path.dest));
	gutil.log('clean ' + gutil.colors.blue(path.tmp));
	return del([path.dest, path.tmp], {force: true});
});

// ----------------------------------------------------------------
// Task: Default
// ----------------------------------------------------------------
gulp.task('default', gulp.series('img', 'sprite', 'fonts', 'css', 'js', 'html', 'inky'));

// ----------------------------------------------------------------
// Task: Build
// ----------------------------------------------------------------
gulp.task('build', gulp.series('backup', 'clean', 'default'));

// ----------------------------------------------------------------
// Task: Dev
// ----------------------------------------------------------------
gulp.task('dev', gulp.series('build', gulp.parallel('serve', 'watch')));

// ----------------------------------------------------------------
// Task: Send Email
// ----------------------------------------------------------------
gulp.task('sendEmail', gulp.series('inky', 'email'));
