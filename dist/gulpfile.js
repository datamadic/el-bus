'use strict';

var gulp = require('gulp');
var babel = require('gulp-babel');
var watch = require('gulp-watch');

gulp.task('default', function () {

    gulp.src('./*.js').pipe(babel({
        presets: ['es2015']
    })).pipe(gulp.dest('dist'));

    gulp.src('./*.html').pipe(gulp.dest('dist'));

    console.log('built.');

    watch('./*.*', function () {

        gulp.src('./*.js').pipe(babel({
            presets: ['es2015']
        })).pipe(gulp.dest('dist'));

        gulp.src('./*.html').pipe(gulp.dest('dist'));

        console.log('built.', Date.now());
    });

    // return gulp.src('./*.js')
    //     .pipe(babel({
    //         presets: ['es2015']
    //     }))
    //     .pipe(gulp.dest('dist'));
});