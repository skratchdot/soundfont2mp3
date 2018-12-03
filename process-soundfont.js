'use strict';

var cp = require('child_process'),
	fs = require('fs-extra'),
	path = require('path'),
	Midi = require('jsmidgen'),
	SoundfontProcessingError = require('./soundfont-processing-error'),
	defaultCallback = 'window.timbrejs_audiojsonp';

// helper function
function endsWith (str, suffix) {
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function setDefaultOptions (options) {
	if (!options) {
		options = {};
	}

	if (!options.duration) {
		options.duration = 128;
	}

	if (options.velocity === undefined) {
		options.velocity = 64;
	}

	if (options.gain === undefined) {
		options.gain = 0.2;
	}

	if (options.endtick === undefined) {
		options.endtick = 1024;
	}

	if (options.channel === undefined) {
		options.channel = 0;
	}

	if (options.reverb === undefined) {
		options.reverb = true;
	}

	if (options.chorus === undefined) {
		options.chorus = true;
	}

	if (options.debug === undefined) {
		options.debug = function () {};
	}

	return options;
}

function soundfontExists (soundfont, debug) {
	return new Promise(
		function (resolve, reject) {
			fs.exists(soundfont || '', function (exists) {
				if (exists) {
					debug('Using Soundfont: ', soundfont);
					resolve();
				} else {
					reject(new SoundfontProcessingError('The soundfont passed in does not exist.'));
				}
			});
		}
	);
};

function validateOutputFile (output) {
	var isMp3,
		isWav,
		isJs,
		isMid;

	if (typeof output === 'string' && endsWith(output, '.mp3')) {
		isMp3 = true;
	} else if (typeof output === 'string' && endsWith(output, '.wav')) {
		isWav = true;
	} else if (typeof output === 'string' && endsWith(output, '.js')) {
		isJs = true;
	} else if (typeof output === 'string' && endsWith(output, '.mid')) {
		isMid = true;
	} else {
		throw new SoundfontProcessingError('Valid mp3 file name not passed in.');
	}

	return {
		isMp3: isMp3,
		isWav: isWav,
		isJs: isJs,
		isMid: isMid
	};
}

function createMidi (options) {
	var track = new Midi.Track(),
		file = new Midi.File();
	file.addTrack(track);
	track.setInstrument(options.channel, options.instrument);
	track.addNote(options.channel, options.note, options.duration, 0, options.velocity);
	track.addEvent(new Midi.MetaEvent({
		type: Midi.MetaEvent.COPYRIGHT,
		data: 'skratchdot.com',
		time: options.duration + options.endtick
	}));

	return new Promise(
		function (resolve, reject) {
			fs.writeFile(
				options.midiOutFile,
				file.toBytes(),
				'binary',
				function (err) {
					if (err) {
						reject(err);
						return;
					}

					options.debug('Temp Midi File Created: ', options.midiOutFile);
					resolve(options.midiOutFile);
				}
			);
		}
	);
}

function createRawFile (options) {
	if (!options.midiOutFile) {
		throw new SoundfontProcessingError('MIDI temp output file is required to create the raw file');
	}

	if (!options.rawOutFile) {
		throw new SoundfontProcessingError('Raw data filename is required');
	}

	return new Promise(
		function (resolve, reject) {
			cp.execFile('fluidsynth', ['-g', options.gain,
				'-R', (options.reverb ? '1' : '0'),
				'-C', (options.chorus ? '1' : '0'),
				'-F', options.rawOutFile,
				options.soundfont, options.midiOutFile
			], {}, function (err) {
				if (!err) {
					options.debug('Temp Raw File Created: ', options.rawOutFile);
					resolve();
					return;
				}
				reject(err);
			});
		}
	);
}

function trimSilence (options) {
	return new Promise(
		function (resolve, reject) {
			cp.execFile('sox', [
				'-t', 's16', '-r', '44100',
				options.rawOutFile, options.trimmedWaveOutFile,
				'reverse', 'silence', '1', '0.01', '0.01%', 'reverse'
			], {}, function (err) {
				if (!err) {
					options.debug('Silence trimmed from wave file: ', options.trimmedWaveOutFile);
					resolve();
					return;
				}
				reject(err);
			});
		}
	);
}

function copyToOutput (options) {
	return new Promise(
		function (resolve, reject) {
			fs.copy(options.sourceFile, options.destinationFile, function (err) {
				if (!err) {
					options.debug(options.successMessage);
					resolve();
					return;
				}
				reject(err);
			});
		}
	);
}

function createAndCopyMp3 (options) {
	return new Promise(
		function (resolve, reject) {
			cp.execFile(
				'lame',
				[
					'-v',
					options.trimmedWaveOutFile,
					options.output
				],
				{},
				function (err) {
					if (!err) {
						options.debug('MP3 File Created: ', options.output);
						resolve();
						return;
					}
					reject(err);
				});
		}
	);
}

function copyToJS (options) {
	return new Promise(
		function (resolve, reject) {
			// code taken from: http://mohayonao.github.io/timbre.js/misc/audio-jsonp.js
			fs.readFile(options.trimmedWaveOutFile, function (err, data) {
				if (err) {
					reject(err);
				} else {
					var content = defaultCallback;
					if (options.callback && options.callback.length > 0) {
						content = options.callback;
					}
					content += '("' + data.toString('base64') + '", "wav");';
					fs.writeFile(options.output, content, function (err) {
						if (!err) {
							options.debug('JS File Created: ', options.output);
							resolve();
							return;
						}
						reject(err);
					});
				}
			});
		}
	);
}

function removeFile (file, debug) {
	return new Promise(
		function (resolve, reject) {
			fs.unlink(file, function (err) {
				if (err) {
					reject(err);
					return;
				}

				debug('Removed File: ', file);
				resolve();
			});
		}
	);
}

exports = module.exports = function processSoundfont (options) {
	var fileTypeInfo,
		stagingDir,
		prefix,
		midiOutFile,
		rawOutFile,
		trimmedWaveOutFile;

	options = setDefaultOptions(options);

	if (!options.soundfont) {
		throw new SoundfontProcessingError('No soundfont file specified');
	}

	if (!options.output) {
		throw new SoundfontProcessingError('No output file specified');
	}

	if (typeof options.instrument === 'undefined') {
		throw new SoundfontProcessingError('No instrument specified');
	}

	if (typeof options.note === 'undefined') {
		throw new SoundfontProcessingError('No note specified');
	}

	fileTypeInfo = validateOutputFile(options.output);

	stagingDir = options.staging || process.cwd();
	prefix = 'soundfont2mp3_' + (new Date()).getTime();
	midiOutFile = path.join(stagingDir, prefix + '.mid');
	rawOutFile = path.join(stagingDir, prefix + '.raw');
	trimmedWaveOutFile = path.join(stagingDir, prefix + '_trimmed.wav');

	function cleanup () {
		return Promise.all([
			removeFile(midiOutFile, options.debug).then(
				// Make sure nothing is returned if removal succeeds
				function () {}
				// Prevent rejection of one removal from rejecting the Promise.all()
				// promise before the other removals are resolved
			).catch(
				function (err) {
					return err;
				}
			),
			removeFile(rawOutFile, options.debug).then(
				function () {}
			).catch(
				function (err) {
					return err;
				}
			),
			removeFile(trimmedWaveOutFile, options.debug).then(
				function () {}
			).catch(
				function (err) {
					return err;
				}
			)
		]).then(
			function (results) {
				var errors = [];

				var resultIndex = 0;

				var resultsLength = results.length;

				for (; resultIndex < resultsLength; resultIndex++) {
					if (results[resultIndex]) {
						errors.push(results[resultIndex]);
					}
				}

				if (errors.length > 0) {
					return Promise.reject(errors);
				}
			}
		);
	}

	// make sure programs/files exist, then create mid/wav/mp3 files, then cleanup
	return soundfontExists(options.soundfont, options.debug).then(
		function () {
			return createMidi({
				midiOutFile: midiOutFile,
				channel: options.channel,
				instrument: options.instrument,
				note: options.note,
				duration: options.duration,
				velocity: options.velocity,
				endtick: options.endtick,
				debug: options.debug
			}).then(
				function () {
					return createRawFile({
						soundfont: options.soundfont,
						reverb: options.reverb,
						chorus: options.chorus,
						gain: options.gain,
						midiOutFile: midiOutFile,
						rawOutFile: rawOutFile,
						debug: options.debug
					});
				}
			).then(
				function () {
					return trimSilence({
						rawOutFile: rawOutFile,
						trimmedWaveOutFile: trimmedWaveOutFile,
						debug: options.debug
					});
				}
			).then(
				function () {
					if (fileTypeInfo.isMid) {
						return copyToOutput({
							sourceFile: midiOutFile,
							destinationFile: options.output,
							successMessage: 'Midi File Created: ' + options.output,
							debug: options.debug
						});
					}

					if (fileTypeInfo.isWav) {
						return copyToOutput({
							sourceFile: trimmedWaveOutFile,
							destinationFile: options.output,
							successMessage: 'Wave File Created: ' + options.output,
							debug: options.debug
						});
					}

					if (fileTypeInfo.isMp3) {
						return createAndCopyMp3({
							trimmedWaveOutFile: trimmedWaveOutFile,
							output: options.output,
							debug: options.debug
						});
					}

					if (fileTypeInfo.isJs) {
						return copyToJS({
							trimmedWaveOutFile: trimmedWaveOutFile,
							output: options.output,
							callback: options.callback,
							debug: options.debug
						});
					}
				}
			);
		}
		// Support for .finally() is spotty; this is a suitable workaround
	).then(cleanup).catch(
		(err) => {
			cleanup();

			return Promise.reject(err);
		}
	);
};
