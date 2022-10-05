const path = require("path");

const settings = {
	profile: "EStoreFashion_All",
	// profile: "Universities_EN",
	inFileUrls: path.join("./Inputs/ECommerce.Fashion", "ECommerce.FashionClothes.ALL.txt"),
	// inFileUrls: path.join("./Inputs/Universities", "Unis.EN_0-650.txt"),
	ffRunParams: {
		source: "--source-dir=/Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/addon/",
		ff: "--firefox=/Users/Aleksii/tmp/Firefox Developer Edition.app/Contents/MacOS/firefox-bin",
		_prflPrefix: "--firefox-profile=",
		// prfl: "/Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/FF.Profile_Sports_Clean", // uncomment to use a specific one
		prflClean: "/Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/DatColl_[CPY]_Clean/"
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
