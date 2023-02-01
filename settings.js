const path = require("path");

const settings = {
	profile: "[some name a folder where everything will be collected]",
	inFileUrls: "path to list of urls to process, one url per line",
	ffRunParams: { // params to run ff with webext
		source: "--source-dir=[this addon location]",
		ff: "--firefox=[ff binary location]",
		_prflPrefix: "--firefox-profile=",
		// prfl: "[specific profile you might want to use]", // uncomment to use a specific one
		prflClean: "[path to a clean ff profile to copy if there isn't any other to use]"
	},
	// profile: "TestProfile",
	// inFileUrls: path.join("./Inputs", "[proto]input.sports.7.txt"),
	fullLengthScreenshot: true,
	browserWindowSize: {
		w: 1440,
		h: 900
	}, // px
	pageLoadWait: 5000, // ms <-- I don't really use it... // TODO: propagate it all the way down to Content Script settings
	// TODO: add an option for debug screenshot collection
	allowUrlPath: false, // false loads homepages, strips off path
	iframeLoadTimeout: 25000, // should be at least 11000
	preVisitingNeeded: true,
	screenshotsNeeded: true,
	htmlNeeded: true,
	screenshotVariants: [ // leave empty if scrambled page versions aren't needed
		// {img: "placeholder", txt: "normal"},
		// {img: "emptySpace", txt: "randomScramble"},
		{img: "avg", txt: "normal"},
		{img: "blur", txt: "normal"},
		{img: "avg", txt: "randomScramble"},
		{img: "blur", txt: "randomScramble"},
		{img: "avgWithIcons", txt: "randomScramble"}
		// {img: "normal", txt: "randomChars"} // randomChars doesn't work
		// text options: normal, nonEnglishRandom, randomScramble
		// img options: normal, placeholder, avg, blur
	],
	pageVarsNeeded: true,
	pagesOpenAtOnce: 1,
	debug: true
};

settings.iframeHandlingNeeded= settings.contentScrambledScreenshotsNeeded || settings.pageVarsNeeded;

module.exports = settings;
