#!/usr/bin/env node

var packageInfo = require('./package.json'),
	async = require('async'),
	program = require('commander'),
	cp = require('child_process'),
	fs = require('fs-extra'),
	Midi = require('jsmidgen'),
	file = new Midi.File(),
	track = new Midi.Track(),
	prefix = 'soundfont2mp3_' + (new Date()).getTime(),
	fileMidi = prefix + '.mid',
	fileRaw = prefix + '.raw',
	fileWaveTrimmed = prefix + '_trimmed.wav',
	defaultCallback = 'window.timbrejs_audiojsonp',
	endsWith,
	isMid = false,
	isMp3 = false,
	isWav = false,
	isJs = false;

program
	.version(packageInfo.version, '-v, --version')
	.option('-c, --channel <channel>', 'the midi channel', 0)
	.option('-i, --instrument <instrument>', 'the midi instrument', 0)
	.option('-n, --note <note>', 'the midi note to export', 64)
	.option('-d, --duration <duration>', 'the duration of the note in ticks. ' +
			'there are 128 ticks per beat, so a quarter note has a duration of 128.', 128)
	.option('-v, --velocity <velocity>', 'the velocity of the note', 64)
	.option('-g, --gain <gain>', 'the velocity of the note', 0.2)
	.option('-e, --endtick <endtick>', 'the tick number of the end of the track', 1024)
	.option('-s, --soundfont <soundfont>', 'the soundfont file', null)
	.option('-o, --output <output>', 'the .mp3/.wav/.js/.mid file to output', null)
	.option('--callback <callback>', 'when output is .js, this is the callback function name.', defaultCallback)
	.option('--no-reverb', 'don\'t add reverb')
	.option('--no-chorus', 'don\'t add chorus')
	.parse(process.argv);

// helper function
endsWith = function (str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

// make sure programs/files exist, then create mid/wav/mp3 files, then cleanup
async.series({
	soundfontExists: function (callback) {
		fs.exists(program.soundfont || '', function (exists) {
			if (exists) {
				console.log('Using Soundfont: ', program.soundfont);
				callback();
			} else {
				callback(new Error('The soundfont passed in does not exist.'));
			}
		});
	},
	validFilePassedIn: function (callback) {
		if (typeof program.output === 'string' && endsWith(program.output, '.mp3')) {
			isMp3 = true;
			callback();
		} else if (typeof program.output === 'string' && endsWith(program.output, '.wav')) {
			isWav = true;
			callback();
		} else if (typeof program.output === 'string' && endsWith(program.output, '.js')) {
			isJs = true;
			callback();
		}  else if (typeof program.output === 'string' && endsWith(program.output, '.mid')) {
			isMid = true;
			callback();
		} else {
			callback(new Error('Valid mp3 file name not passed in.'), null);
		}
	},
	createMidi: function (callback) {
		file.addTrack(track);
		track.setInstrument(program.channel, program.instrument);
		track.addNote(program.channel, program.note, program.duration, 0, program.velocity);
		track.addEvent(new Midi.MetaEvent({
			type: Midi.MetaEvent.COPYRIGHT,
			data: 'skratchdot.com',
			time: program.duration + program.endtick
		}));
		fs.writeFile(fileMidi, file.toBytes(), 'binary', function (err) {
			console.log('Temp Midi File Created: ', fileMidi);
			callback(err, fileMidi);
		});
	},
	createRaw: function (callback) {
		cp.execFile('fluidsynth', ['-g', program.gain,
		                           '-R', (program.reverb ? '1' : '0'),
		                           '-C', (program.chorus ? '1' : '0'),
		                           '-F', fileRaw,
		                           program.soundfont, fileMidi], {}, function (err) {
			if (!err) {
				console.log('Temp Raw File Created: ', fileRaw);
			}
			callback(err);
		});
	},
	trimSilence: function (callback) {
		cp.execFile('sox', [
				'-t', 's16', '-r', '44100',
				fileRaw, fileWaveTrimmed,
				'reverse', 'silence', '1', '0.01', '0.01%', 'reverse'
			], {}, function (err) {
			if (!err) {
				console.log('Silence trimmed from wave file: ', fileWaveTrimmed);
			}
			callback(err);
		});
	},
	finalizeMid: function (callback) {
		if (isMid) {
			fs.copy(fileMidi, program.output, function (err) {
				if (!err) {
					console.log('Midi File Created: ', program.output);
				}
				callback(err);
			});
		} else {
			callback();
		}
	},
	finalizeWav: function (callback) {
		if (isWav) {
			fs.copy(fileWaveTrimmed, program.output, function (err) {
				if (!err) {
					console.log('Wave File Created: ', program.output);
				}
				callback(err);
			});
		} else {
			callback();
		}
	},
	finalizeMp3: function (callback) {
		if (isMp3) {
			cp.execFile('lame', ['-v', fileWaveTrimmed, program.output], {}, function (err) {
				if (!err) {
					console.log('MP3 File Created: ', program.output);
				}
				callback(err);
			});
		} else {
			callback();
		}
	},
	// code taken from: http://mohayonao.github.io/timbre.js/misc/audio-jsonp.js
	finalizeJs: function (callback) {
		if (isJs) {
			fs.readFile(fileWaveTrimmed, function (err, data) {
				if (err) {
					callback(err);
				} else {
					var content = defaultCallback;
					if (program.callback && program.callback.length > 0) {
						content = program.callback;
					}
					content += '("' + data.toString('base64') + '", "wav");';
					fs.writeFile(program.output, content, function (err) {
						if (!err) {
							console.log('JS File Created: ', program.output);
						}
						callback(err);
					});
				}
			});
		} else {
			callback();
		}
	},
	removeMidi: function (callback) {
		fs.unlink(fileMidi, function (err) {
			console.log('Removed File: ', fileMidi);
			callback(err);
		});
	},
	removeRaw: function (callback) {
		fs.unlink(fileRaw, function (err) {
			console.log('Removed File: ', fileRaw);
			callback(err);
		});
	},
	removeWaveTrimmed: function (callback) {
		fs.unlink(fileWaveTrimmed, function (err) {
			console.log('Removed File: ', fileWaveTrimmed);
			callback(err);
		});
	}
}, function (err, results) {
	if (err) {
		console.error(err);
	} else {
		console.log('Done.');
	}
});
