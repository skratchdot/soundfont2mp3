# soundfont2mp3

soundfont2mp3 is a command line utility that lets you extract
single note mp3s from soundfont files.


## Installation ##

Install the command line tool globally by running:

	npm install -g soundfont2mp3


## Usage ##

	Usage: soundfont2mp3 [options]


## Options ##

	-h, --help                     output usage information
	-v, --version                  output the version number
	-c, --channel <channel>        the midi channel
	-i, --instrument <instrument>  the midi instrument
	-n, --note <note>              the midi note to export
	-d, --duration <duration>      the duration of the note in ticks. there are
	                               128 ticks per beat, so a quarter note has a
	                               duration of 128.
	-v, --velocity <velocity>      the velocity of the note
	-g, --gain <gain>              the velocity of the note
	-e, --endtick <endtick>        the tick number of the end of the track
	-s, --soundfont <soundfont>    the soundfont file
	-o, --output <output>          the mp3 file to output
	--no-reverb                    don't add reverb
	--no-chorus                    don't add chorus



## Dependencies

- [FluidSynth](http://sourceforge.net/apps/trac/fluidsynth/)

- [Lame](http://lame.sourceforge.net/)

- [Sox](http://sox.sourceforge.net/)

- A valid soundfont file (see [Free Soundfonts](https://github.com/skratchdot/soundfont2mp3/#free-soundfonts))


## Free Soundfonts

- [S. Christian Collins GeneralUser GS](http://www.schristiancollins.com/generaluser.php) - 30 MB

- [Fluid (R3) General MIDI SoundFont (GM)](http://packages.debian.org/search?keywords=fluid-soundfont-gm) - 140 MB


## Example Usage

```bash
#!/bin/bash
BASE_FOLDER="."
SOUNDFONT="./gs.sf2"

# make channel folder
mkdir -p "$BASE_FOLDER/channel"
mkdir -p "$BASE_FOLDER/channel/0"
mkdir -p "$BASE_FOLDER/channel/0/instrument"

for i in {0..127}
do
	mkdir -p "$BASE_FOLDER/channel/0/instrument/$i";
	for j in {0..127}
	do
		soundfont2mp3 -i $i -s "$SOUNDFONT" -o "$BASE_FOLDER/channel/0/instrument/$i/$j.mp3"
	done
done
```

