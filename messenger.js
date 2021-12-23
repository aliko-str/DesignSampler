#!/usr/local/bin/node

//const {TextEncoder} = require("util");

const tmpFileForOurMessenger = "./.dataForMessenger.txt";

const fs = require("fs");
const path = require("path");
// const { spawn } = require("child_process");
const rMessenger = require(path.join(__dirname, "R", "r.messenger.js"));
const showLogMsgs = true;
//const _ = require("underscore");

(function setUpConsole() {
	// NOTE: it's probably the reason I get an error from FF - because console.log uses stdout that FF listens to
	//	const logF = fs.createWriteStream()
	// It's important to have the order of messages right - not possible when mixing different consoles, files, outputs in different plages --> Just redirect it all to 'warn' - it's a semi-solution
	Object.assign(console, {
		log: function() {
			if (showLogMsgs) {
				console.warn(...arguments);
			}
		}
	});

})();
// Redirect console.log to a Log file instead of stdout -- otherwise FF addon sees it as a message

(function talkToMainApp() {
	fs.promises.readFile(tmpFileForOurMessenger, "utf8").then(function(data) {
		const profileName = JSON.parse(data).profileName;
		console.warn("Profile Name: ", profileName);
		initAndRunAddonMessenger(profileName);
	});
})();

function sendMessage(action, data) {
	const msg = JSON.stringify({
		action: action,
		data: data
	});
	var header = Buffer.alloc(4);
	header.writeUInt32LE(msg.length, 0);
	process.stdout.write(header);
	process.stdout.write(msg);
}

function sendConfirmation(msgObj) {
	return sendMessage(msgObj.action + ".confirmed", {
		urlId: msgObj.urlId
	});
}

//async function handlePageDone(msgObj, ioLocUtil, glJobProgress, ifPrevisit) {
//	console.log("Page done: ", msgObj.urlId);
//	let i = glJobProgress.findIndex(x => x.url === msgObj.urlId);
//	if (i < 0) {
//		throw new Error("URL for marking as done NOT FOUND in glJobProgress: " + msgObj.urlId);
//	}
//	glJobProgress[i].allDone = true;
//	await ioLocUtil.saveJobProgressArr(glJobProgress);
//}

async function updateProgress(msgObj, ioLocUtil, glJobProgress, updateObj) {
	console.log("JobProgress Updated done: ", msgObj.urlId);
	let i = glJobProgress.findIndex(x => x.url === msgObj.urlId);
	if (i < 0) {
		throw new Error("URLID for marking as done NOT FOUND in glJobProgress: " + msgObj.urlId);
	}
	Object.assign(glJobProgress[i], updateObj);
	await ioLocUtil.saveJobProgressArr(glJobProgress);
}

async function cleanUpProgress(ioLocUtil, glJobProgress){
	// Maybe I should move this away from messenger?... It's not exactly about messenging
	// Removing duplicates
	const _refObj = {};
	const cleanProgress = glJobProgress.filter(progrObj=>{
		if(_refObj[progrObj.actualUrl]){
			// if already present - filter out
			console.log("[cleanUpProgress] Duplicate actualUrl found: ", progrObj.actualUrl, " for ", progrObj.url, " and ", _refObj[progrObj.actualUrl], " Keeping the 2nd one only.");
			return false;
		}
		_refObj[progrObj.actualUrl] = progrObj.url;
		return true;
	});
	await ioLocUtil.saveJobProgressArr(cleanProgress);
	return cleanProgress;
}

function initAndRunAddonMessenger(profileName) {
	// 1 - Set up 'global' variables
	const ioLocUtil = require("./io.loc.util.js").init(profileName);
	var settings, glJobProgress, glPageMods;

	listen(msgHandlerF);

	//	Promise.all([ioLocUtil.readSettings(), ioLocUtil.readJobProgressArr(), ioLocUtil.readPageMods()]).then(function (dat) {
	//		[settings, glJobProgress, glPageMods] = dat;
	//		listen(msgHandlerF);
	//	});

	function msgHandlerF(msgObj) {
		//		console.warn("Message arrived to the APP");
		switch (msgObj.action) {
			case "AddonLoaded":
				console.log("Addon loaded and ready for SetUpData.");
			case "GetSetUpData":
				Promise.all([ioLocUtil.readSettings(), ioLocUtil.readJobProgressArr(), ioLocUtil.readPageMods()]).then(function(dat) {
					[settings, glJobProgress, glPageMods] = dat;
					return Promise.resolve({
						settings: settings,
						jobProgress: glJobProgress,
						pageMods: glPageMods
					});
				}).then((data) => {
					sendMessage("SetUpData", data);
				});
				break;
			case "SetUpFinished":
				console.log("Addon loaded and ready for action.");
				break;
			case "RemovePage": {
				console.log("Page to be removed and not screenshotted: ", msgObj.urlId);
				let i = glJobProgress.findIndex(x => x.url === msgObj.urlId);
				if (i < 0) {
					throw new Error("URL for removal NOT FOUND in glJobProgress: " + msgObj.urlId);
				}
				glJobProgress.splice(i, 1); // removing the bad page from processing
				ioLocUtil.saveJobProgressArr(glJobProgress).then(() => {
					sendConfirmation(msgObj);
				});
				break;
			}
			case "CleanUpProgress":
				// For now we just remove duplicates for actualUrl and re-save it all
				cleanUpProgress(ioLocUtil, glJobProgress).then(cleanedJobProgr=>{
					glJobProgress = cleanedJobProgr;
					sendConfirmation(msgObj);
				});
				break;
			case "SavePageScript":
				try {
					console.log("Custom script for a page arrived: ", msgObj.urlId);
					if (glPageMods[msgObj.urlId] === undefined) {
						throw new Error("URL Not found in pageMods:" + msgObj.urlId);
					}
					glPageMods[msgObj.urlId] = msgObj.funcAsStr;
					ioLocUtil.savePageMods(glPageMods).then(function() {
						return updateProgress(msgObj, ioLocUtil, glJobProgress, {
							"previsitingDone": true,
							"actualUrl": msgObj.newHref
						});
					}).then(function() {
						sendConfirmation(msgObj);
					});	
				} catch (e) {
					console.error(e);
				}
				break;
			case "MarkPageDone": {
				updateProgress(msgObj, ioLocUtil, glJobProgress, {
					"allDone": true
				}).then(() => {
					sendConfirmation(msgObj);
				});
				break;
			}
			case "SaveTxt": {
				const dirName = path.join(__dirname, "profiles", settings.profile, ...msgObj.folders);
				fs.promises.access(dirName).catch(() => {
					return fs.promises.mkdir(dirName, {
						recursive: true
					});
				}).then(() => {
					fs.promises.writeFile(path.join(dirName, msgObj.name + "." + (msgObj.type || "txt")), msgObj.dat, 'utf8').then(() => {
						sendConfirmation(msgObj);
					});
				});
				break;
			}
			case "SaveTxtArr": {
				const dirName = path.join(__dirname, "profiles", settings.profile, ...msgObj.folders);
				fs.promises.access(dirName).catch(() => {
					return fs.promises.mkdir(dirName, {
						recursive: true
					});
				}).then(() => {
					return Promise.all(msgObj.dat.map(txtObj => {
						let fullFName = path.join(dirName, txtObj.name + "." + (txtObj.type || msgObj.type || "txt"));
						return fs.promises.writeFile(fullFName, txtObj.dat, "utf8");
					}));
				}).then(() => {
					sendConfirmation(msgObj);
				});
				break;
			}
			case "RequestRAction": {
				const rSett = {
					dataFolder: path.join(__dirname, "profiles", settings.profile, ...msgObj.dataFolder)
				};
				rMessenger.doInRAsync(msgObj.RAction, rSett).then((data) => {
					sendMessage("RequestRAction.Reply", {urlId: msgObj.urlId, data: data});
				}).catch(e=>{
					console.error(e);
					throw e;
				});
				break;
			}
			case "SaveImg": {
				const dirName = path.join(__dirname, "profiles", settings.profile, ...msgObj.folders);
				fs.promises.access(dirName).catch(() => {
					return fs.promises.mkdir(dirName, {
						recursive: true
					});
				}).then(() => {
					fs.promises.writeFile(path.join(dirName, msgObj.name + "." + (msgObj.type || "png")), msgObj.dat, 'base64').then(() => {
						sendConfirmation(msgObj);
					});
				});
				break;
			}
			case "SaveImgArr": {
				// console.error("[Messenger] SaveImgArr arrived from: ", msgObj.urlId);
				const dirName = path.join(__dirname, "profiles", settings.profile, ...msgObj.folders);
				fs.promises.access(dirName).catch(() => {
					return fs.promises.mkdir(dirName, {
						recursive: true
					});
				}).then(() => {
					// console.error("STARTING to write image array");
					return Promise.all(msgObj.dat.map(imgObj => {
						let fullFName = path.join(dirName, imgObj.name + (msgObj.type || ".png"));
						// console.error("Writing file -- in messenger.js", fullFName);
						return fs.promises.writeFile(fullFName, imgObj.dat, "base64").then(()=>{
							// console.error("FINISHED writing ", fullFName);
						});
					}));
				}).then(() => {
					// console.error("DONE WRITING IMG ARRay -- in messenger.js");
					sendConfirmation(msgObj);
				});
				break;
			}
			default:
				if (msgObj.action !== undefined) {
					throw new Error("msgObj has an action, but isn't handled ==> Add a handler for '" + msgObj.action + "'");
				}
				// this message isn't for us - ignore it
				break;
		}
	}
}

//
//function _urlToHost(url) {
//	return url.split("://")[1].split("/")[0];
//}

// this F needs no external variables, just a message handler, so keeping it outside of init()
function listen(msgHandler) {
	console.log("LISTENING NOw for messages from the Addon");

	let payloadSize = null;

	// A queue to store the chunks as we read them from stdin.
	// This queue can be flushed when `payloadSize` data has been read
	let chunks = [];

	// Only read the size once for each payload
	const sizeHasBeenRead = () => Boolean(payloadSize);

	// All the data has been read, reset everything for the next message
	const flushChunksQueue = () => {
		payloadSize = null;
		chunks.splice(0);
	};

	const processData = () => {
		// Create one big buffer with all all the chunks
		const stringData = Buffer.concat(chunks);

		// The browser will emit the size as a header of the payload,
		// if it hasn't been read yet, do it.
		// The next time we'll need to read the payload size is when all of the data
		// of the current payload has been read (ie. data.length >= payloadSize + 4)
		if (!sizeHasBeenRead()) {
			payloadSize = stringData.readUInt32LE(0);
		}

		// If the data we have read so far is >= to the size advertised in the header,
		// it means we have all of the data sent.
		// We add 4 here because that's the size of the bytes that old the payloadSize
		if (stringData.length >= (payloadSize + 4)) {
			// Remove the header
			const contentWithoutSize = stringData.slice(4, (payloadSize + 4));

			// Do something with the data...
			const json = JSON.parse(contentWithoutSize);
			msgHandler(json);

			// Record leftover data to add back in Chunks
			let leftData = stringData.slice((payloadSize + 4));

			// Reset the read size and the queued chunks
			flushChunksQueue();

			// Add leftover data back in Buffer and repeat processing
			if (leftData.length) {
				chunks.push(leftData);
				processData();
			}
		}
	};

	process.stdin.on('readable', () => {
		// A temporary variable holding the nodejs.Buffer of each
		// chunk of data read off stdin
		let chunk = null;

		// Read all of the available data
		while ((chunk = process.stdin.read()) !== null) {
			chunks.push(chunk);
		}

		processData();

	});
}
