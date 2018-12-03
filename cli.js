#!/usr/bin/env node

'use strict';

var packageInfo = require('./package.json'),
	program = require('commander'),
	processSoundfont = require('./process-soundfont');

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
	.option('--staging <directory>', 'directory in which to place intermediate files generated during the process', process.cwd())
	.option('--callback <callback>', 'when output is .js, this is the callback function name.')
	.option('--no-reverb', 'don\'t add reverb')
	.option('--no-chorus', 'don\'t add chorus')
	.parse(process.argv);

var options = {
	soundfont: program.soundfont,
	output: program.output,
	instrument: program.instrument,
	note: program.note,
	duration: program.duration,
	velocity: program.velocity,
	endtick: program.endtick,
	gain: program.gain,
	reverb: program.reverb,
	chorus: program.chorus,
	staging: program.staging,
	channel: program.channel,
	callback: program.callback,
	debug: console.log
};

processSoundfont(
	options
).then(
	function () {
		console.log('Done.');
	}
).catch(
	function (err) {
		console.error(err);
	}
);
