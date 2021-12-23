// TODO deal with path joining for Win32

const util = require("util");
const {
	exec,
	spawn
} = require("child_process");
const execAsync = util.promisify(exec);
const fs = require("fs");
const path = require("path");
const _ = require("underscore");
//const msgr = require("messenger");

const settings = require("./settings");
const tmpFileForOurMessenger = "./.dataForMessenger.txt";
const profileRoot = path.join(".", "profiles", settings.profile);
const jobProgressF = path.join(profileRoot, "jobProgress.json");
const pageModsF = path.join(profileRoot, "myPageMods.js");
// const webExtParams = settings.ffRunParams;

// const webExtParams = {
// 	source: "--source-dir=/Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/addon/",
// 	ff: "--firefox=/Users/Aleksii/tmp/Firefox Developer Edition.app/Contents/MacOS/firefox-bin",
// //	ff: "--firefox=/Users/Aleksii/tmp/Firefox.v85.app/Contents/MacOS/firefox-bin",
// 	// prfl: "--firefox-profile=/Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/Dev.FFv83.ProfileToUse"
// 	prfl: "--firefox-profile=/Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/FF.Profile_Sports_Clean"
// };

const glJobProgress = [];
const glPageMods = {}; // I prefer to keep pageMods and JobProgress separate - it's simply easier to read them and modify manually if needed - serialized functions are too cumbersome for a table-like overview of jobProgress

//const APP_PORT = "127.0.0.1:9999";
//const msgrSpeaker = msgr.createSpeaker(APP_PORT);
//const msgrListener = msgr.createListener(APP_PORT);

(async function main() {
//	await lintIt();
	await checkFfMsgAllowed();
	await makeFFProfile();
	await makeProfile();
//	if(!settings.debug){ // No longer needed
//		// because developer tool don't render if we change chrome.css
//		await updateUserChromeCSS();	// No longer needed
//	}
	setUpListening();
	launchFF();
	// probably all done here ==> Set up handlers for data in Messenger.js
})();

// service Funcs
function createJobProgressArr(urlsToVisit) {
	console.log("Creating a JobProgress object to store a current state of the job.");
	// a - remove duplicates
	const uniqueUrls = [...new Set(urlsToVisit)];
	console.log("Number of duplicate urls: %d, left URLs to visit: ", urlsToVisit.length - uniqueUrls.length, uniqueUrls.length);
	// b - add all properties
	return uniqueUrls.map(function (aUrl) {
		return {
			url: aUrl,
			allDone: false,
			previsitingDone: false,
			actualUrl: aUrl
		};
	});
}

//async function saveJobProgressArr(jobProgress) {
//	jobProgress = jobProgress || glJobProgress;
//	// make it readable
//	const jobProgressStr = JSON.stringify(jobProgress).replace(/,"/gi, "\t").replace(/},/gi, "\n");
//	return await fs.promises.writeFile(jobProgressF, jobProgressStr, "utf8");
//}
//
//async function readJobProgressArr() {
//	const jobProgressStr = await fs.promises.readFile(jobProgressF, "utf8");
//	const jobProgress = JSON.parse(jobProgressStr.replace(/\t/gi, ",\"").replace(/\n/gi, "},"));
//	return jobProgress;
//}
//
//async function savePageMods(pageMods) {
//	pageMods = pageMods || glPageMods;
//	const toBeSavedObj = _.mapObject(pageMods, (val, key) => {
//		return val.toString();
//	});
//	const toBeSavedStr = "module.exports = {" + _.pairs(toBeSavedObj).map(x => ("\"" + x[0] + "\": " + x[1])).join(",\n") + "}";
//	return await fs.promises.writeFile(pageModsF, toBeSavedStr, "utf8");
//}

// END service Funcs

// 0 - lint the addon
async function lintIt() {
	console.log("Linting it");
	const lintCmb = ["web-ext lint --self-hosted", settings.ffRunParams.source].join(" ");
	const {
		stdout,
		stderr
	} = await execAsync(lintCmb);
	console.error('stderr:', stderr);
	console.log('stdout:', stdout);
}

// 0.1 - Make sure FF knows this script can listen to messages from the addon
async function checkFfMsgAllowed() {
	if (process.platform === "darwin") {
		const copyTo = "/Users/Aleksii/Library/Application Support/Mozilla/NativeMessagingHosts/myFFaddon.batch.screenshot.json";
		const copyFrom = "/Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/resources/myFFaddon.batch.screenshot.json";
//		const permFStr = await fs.promises.readFile(copyFrom, "utf8");
//		const permJson = JSON.parse(permFStr);
//		permJson.data.profileName = settings.profile;
//		await fs.promises.writeFile(copyTo, JSON.stringify(permJson), "utf8");
		await fs.promises.copyFile(copyFrom, copyTo);
		console.log("Now Putting persmissions for native message ing the right place");
		return;
	} else if (process.platform === "win32") {
		throw new Error("Need to set up messaging on Win - not done yet");
	}
	throw new Error("Unexpected platform - Do we have a non-win server?..");
}

async function makeFFProfile(){
	if(settings.ffRunParams.prfl !== undefined){
		console.log("[MAIN] Settings point to an existing FF profile");
		if(await _exists(settings.ffRunParams.prfl)){
			console.log("[MAIN] FF profile folder exists. Next step.");
			return;
		}
		throw "FF profile set in (loc) settings.js does not exist on HD";
	}else{
		const to = path.join(__dirname, "FF.profiles", "[FF.profile]" + settings.profile);
		settings.ffRunParams.prfl = to; // keeping it for posterity mainly - it'll be re-assigned every time anyway
		if(await _exists(to)){
			console.log("[MAIN] FF profile Folder already exists on HD. Not re-creating it.. Delete manually if needed.", to);
			return;
		}
		console.log("[MAIN] Creating a fresh FF profile", to);
		const from = settings.ffRunParams.prflClean;
		await fs.promises.cp(from, to, {recursive: true});
	}
}

async function _exists(dir){
	return await fs.promises.access(dir).then(() => true).catch(() => false);
}

// 1 - create profile folder and sub-folder; copy files, parse inputs
async function makeProfile() {
	// 1.1 - create a subfolder structure
	const profExists = await fs.promises.access(profileRoot).then(() => true).catch(() => false);
	if (!profExists) {
		await fs.promises.mkdir(profileRoot);
	} else {
		console.log("Profile %s already exists --> Not re-creating", settings.profile);
	}
	// 1.1.1 - Let's save settings.json - so we keep a copy of original settings and know for sure what we collected and how
	const locSettF = path.join(profileRoot, "locSettings.json");
	const locSettExist = await fs.promises.access(locSettF).then(() => true).catch(() => false);
	if (locSettExist) {
		console.warn("locSettings.json exists - overriding global settings.js with the local values");
		const locSettings = JSON.parse(await fs.promises.readFile(locSettF, "utf8"));
		Object.assign(settings, locSettings);
	} else {
		// if not, create locSettings.json
		console.log("locSettings.json doesn't exist - saving settings.js as it");
		await fs.promises.writeFile(locSettF, JSON.stringify(settings), "utf8");
	}
	// 1.1.2 - Now we know a profile name -- We can load up util IO funcs
	const {readPageMods,	savePageMods,	readJobProgressArr, saveJobProgressArr} = require("./io.loc.util.js").init(settings.profile);
	
	// 1.2 - Copy inputUrls in the profile - so we always know what was the original list; and load them up
	// check if a local copy has already been saved
	const locUrlsArrExists = await fs.promises.access(jobProgressF).then(() => true).catch(() => false);
	if (locUrlsArrExists) {
		console.log("Reading a local copy of Url Array <-- delete it if refreshing is needed");
		// load it up
		const jobProgress = await readJobProgressArr();
		glJobProgress.push(...jobProgress);

	} else {
		// first run - fresh jobProgressArr is to be created
		console.log("No jobProgress.json file found -- creating it and the object");
		const inUrlsAsText = await fs.promises.readFile(settings.inFileUrls, "utf8");
		var allUrlsArr = inUrlsAsText.trim().split("\n").map(x => x.split('\t')[0]);
		if (!settings.allowUrlPath) {
			// only Hostnames, i.e., homepages to be visited
			const hostnameRegEx = /(http[s]*\:\/\/[\w\.\-]*\/|$)/;
			allUrlsArr = allUrlsArr.map(function (x) {
				const res = (x + "/").match(hostnameRegEx);
				if (res === null) {
					throw new Error("can't extract hostname from:" + x);
				}
				return res[0];
			});
		}
		glJobProgress.push(...createJobProgressArr(allUrlsArr));
		// and finally save the newly created file to hd
		await saveJobProgressArr(glJobProgress);
	}
	// 1.3 - Read myPageMods.js - if it exists
	const pageModsExist = await fs.promises.access(pageModsF).then(() => true).catch(() => false);
	if (pageModsExist) {
		const savedPageMods = readPageMods();// require(path.join(profileRoot, "myPageMods.js"));
		Object.assign(glPageMods, savedPageMods);
	} else {
		// init pageMods with no-op f
		Object.assign(glPageMods, _.object(glJobProgress.map(x => [x.url, () => {}])));
		await savePageMods(glPageMods);
	}
}

//// 2 - update ff profile files - mainly browser window size with userChrome.css
//async function updateUserChromeCSS() { // NO LONGER NEEDED HERE - implemented Experimental API
//	console.log("Updating userChrome.CSS now");
//	const pathToChromeCSS = path.join(".", "Dev.FFv83.ProfileToUse", "chrome", "userChrome.css");
//	const scrollBarCss = ":root{scrollbar-width: none !important;}";
//	const browserWindowCss = util.format("browser{width: %dpx !important;height: %dpx !important;}", settings.browserWindowSize.w, settings.browserWindowSize.h);
//	await fs.promises.writeFile(pathToChromeCSS, [browserWindowCss, scrollBarCss].join("\n"), "utf8");
//}


// 3 - set up listeners for data, requests for settings, etc
async function setUpListening() {
	await fs.promises.writeFile(tmpFileForOurMessenger, JSON.stringify({"profileName": settings.profile}), "utf8");
	console.log("Telling messenger.js what profile it will serve ==> it only works if a single instance is running, which should be the case -- I simply don't care for implementing robust messaging between processes, and 'messenger' library is awful..");
//	const a = "#!/usr/local/bin/node /Users/Aleksii/Projects/FF.v83.Addon.ScreenAndVars/messenger.js";
}

// 4 - Launch ff
function launchFF() {
	const ls = spawn("web-ext", ["run", settings.ffRunParams.source, "--browser-console", settings.ffRunParams.ff, settings.ffRunParams._prflPrefix + settings.ffRunParams.prfl, "--keep-profile-changes", "--no-reload"]);

	ls.stdout.on("data", data => {
		console.log(`FF process stdout: ${data}`);
	});

	ls.stderr.on("data", data => {
		console.log(`FF process stderr: ${data}`);
	});

	ls.on('error', (error) => {
		console.log(`FF process error: ${error.message}`);
	});

	ls.on("close", code => {
		fs.promises.unlink(tmpFileForOurMessenger).then(()=>{
			console.log(`FF process exited with code ${code}`);
			process.exit(code);			
		});
//		msgrSpeaker.ready.then(function(){
//			msgrSpeaker.request("exit", {}, function(){});
//			process.exit(code);
//		});	
	});
}
