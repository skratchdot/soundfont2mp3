#!/usr/bin/env node

var packageInfo = require('./package.json'),
	async = require('async'),
	program = require('commander'),
	cp = require('child_process'),
	fs = require('fs'),
	Midi = require('jsmidgen'),
	file = new Midi.File(),
	track = new Midi.Track(),
	prefix = 'soundfont2mp3_' + (new Date()).getTime(),
	fileMidi = prefix + '.mid',
	fileWave = prefix + '.wav',
	fileWaveTrimmed = prefix + '_trimmed.wav',
	endsWith;

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
	.option('-o, --output <output>', 'the mp3 file to output', null)
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
	mp3FilePassedIn: function (callback) {
		if (typeof program.output === 'string' && endsWith(program.output, '.mp3')) {
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
	createWav: function (callback) {
		cp.execFile('fluidsynth', ['-g', program.gain,
		                           '-R', (program.reverb ? '1' : '0'),
		                           '-C', (program.chorus ? '1' : '0'),
		                           '-F', fileWave,
		                           program.soundfont, fileMidi], {}, function (err) {
			if (!err) {
				console.log('Temp Wave File Created: ', fileWave);
			}
			callback(err);
		});
	},
	trimSilence: function (callback) {
		cp.execFile('sox', [fileWave, fileWaveTrimmed, 'reverse', 'silence', '1', '0.1', '0.1%', 'reverse'], {}, function (err) {
			if (!err) {
				console.log('Silence trimmed from wave file: ', fileWaveTrimmed);
			}
			callback(err);
		});
	},
	createMp3: function (callback) {
		cp.execFile('lame', ['-v', fileWaveTrimmed, program.output], {}, function (err) {
			if (!err) {
				console.log('MP3 File Created: ', program.output);
			}
			callback(err);
		});
	},
	removeMidi: function (callback) {
		fs.unlink(fileMidi, function (err) {
			console.log('Removed File: ', fileMidi);
			callback(err);
		});
	},
	removeWave: function (callback) {
		fs.unlink(fileWave, function (err) {
			console.log('Removed File: ', fileWave);
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
