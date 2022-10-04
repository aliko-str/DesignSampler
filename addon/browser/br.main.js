// TODO: Handle non-200 responses - remove 404 and 500, and tolerate 301


//"use strict";

/* global browser */

//const settings = {};
//var glJobProgress = [];
//const glPageMods = {};
var _foolCheckAssigned = false;
const _closeDeadTabsAfter1Min = false; // Better keep it false -- 1min is definitely not enough
var __debug = true; // overwritten by settings.debug as soon as we have it

browser.browserAction.onClicked.addListener(() => {
	console.log("myFFaddon.batch.screenshot -- addon button clicked");
	// 1 - set up listeners with the node backend
	const port = browser.runtime.connectNative("myFFaddon.batch.screenshot");
	const handleSettings = (msg) => {
		// Actual work
		// 1 - We only react to settings here - everything else is handled downstream; Plus
		if (msg.action === "SetUpData") {
			doAllTheWork(msg.data, port);
			// because it should be the very first and only message from the port, we can unassign the handler - just in case we want to re-launch everything using browserAction
			port.onMessage.removeListener(handleSettings);
		} else {
			throw new Error("We can't be here - doAllTheWork is supposed to be called only once and only for SetUpData action type");
		}
	};
	port.onMessage.addListener(handleSettings);
	port.postMessage({
		action: "AddonLoaded"
	});
});

function listenForTimers(){
	// console.log("LISTENING for timer");
	browser.runtime.onMessage.addListener((msg)=>{
		if(msg.action === "timeout"){
			return new Promise(function(resolve, reject) {
				// console.log("[BG TIMER] duration:", msg.duration);
				window.setTimeout(resolve, msg.duration);
			});
		}
	});
};

// function listenForFetch(){
// 	// console.log("LISTENING for timer");
// 	browser.runtime.onMessage.addListener((msg)=>{
// 		if(msg.action === "fetch"){
// 			console.assert(msg.url);
// 			return window.fetch(msg.url).then(res=>{
// 				debugger;
// 				console.log("BG Fetch returned");
// 				return res;
// 			});
// 		}
// 	});
// };

function _enableFullCORS(httpRespInfo){
	// fixing Web Admins' fuckups -- not set Access-Control-Allow-Origin headers (often leads to non-loaded icons, fonts, etc.)
	const reqTypesToAlter = ["script", "xmlhttprequest", "font"];
	if(reqTypesToAlter.includes(httpRespInfo.type)){ // only for documents
		if(httpRespInfo.responseHeaders){
			const corsHeader = httpRespInfo.responseHeaders.find(obj=>obj.name.toLowerCase() === "access-control-allow-origin");
			if(corsHeader === undefined){
				httpRespInfo.responseHeaders.push({
					name: "Access-Control-Allow-Origin",
					value: "*"
				});
				// console.log("[CORS Mod] Modifying Access-Control-Allow-Origin response header, TO '*''"); // too noisy -- disabling
				return {responseHeaders: httpRespInfo.responseHeaders};
			}
			// console.log("[CORS Mod] NOT Modifying anything, existing Access-Control-Allow-Origin: ", corsHeader.value);
		}	
	}else{
		// console.log("[cenableFullCORS] Type not to be altered: ", httpRespInfo.type);
		// console.log("_%cenableFullCORS", "color:red;");
	}
	return {}; // Empty obj --> modifying nothing
}

function _enableEvalModifCSP(httpRespInfo){
	// probably better only modify Content Security Policy headers for the target Tab, but I don't care about implementing it now -- do it for the entire browser
	// NOTE: didn't work for dynamically inserted <iframes> (e.g., what FB does) -- not sure why --> Nuclear option, set security.csp.enable to "false"
	const reqTypesToAlter = ["sub_frame", "main_frame", "script"];
	if(reqTypesToAlter.includes(httpRespInfo.type)){ // only for documents
		if(httpRespInfo.responseHeaders){
			const cspHeader = httpRespInfo.responseHeaders.find(obj=>obj.name === "content-security-policy");
			if(cspHeader !== undefined){
				const cspPieces = cspHeader.value.split(";");
				const cspScriptSrcI = cspPieces.findIndex(str=>str.indexOf("script-src") > -1);
				if(cspScriptSrcI === -1){
					// script CSP not set -- using our values instead
					cspPieces.push(" script-src 'self' 'unsafe-eval'");
				}else{
					// script CSP is set
					if(cspPieces[cspScriptSrcI].indexOf("unsafe-eval") > -1){
						// do nothing; unsafe-eval already set
						return {};
					}
					// add unsafe eval
					cspPieces[cspScriptSrcI] = cspPieces[cspScriptSrcI] + " 'unsafe-eval'";
				}
				const newCSPVal = cspPieces.join(";");
				console.log("[CSP Mod] Modifying CSP response header, TO", newCSPVal);
				cspHeader.value = newCSPVal; //  FROM", cspHeader.value, "
				return {responseHeaders: httpRespInfo.responseHeaders};
			}
		}	
	}else{
		// console.log("Type not to be altered: ", httpRespInfo.type);
	}
	return {}; // Empty obj --> modifying nothing
}

async function doAllTheWork(setUpData, port) {
	// fool check
	if (!_foolCheckAssigned) {
		port.onMessage.addListener((msg) => {
			// THIS IS TEMPORARY
			// pipe messages to console
			console.log("Msg arrived from App, action:", msg.action);
		});
		_foolCheckAssigned = true;
	}
	// 0 - Preventing accidental clicks on browserAction
	 browser.browserAction.disable();
	// 1.1 - Set up globals
	const settings = setUpData.settings;
	var jobProgress = setUpData.jobProgress;
	const pageMods = setUpData.pageMods;
	__debug = settings.debug;
	// a good place for the CORS header modification -- so I see a non-broken page during previsiting too
	browser.webRequest.onHeadersReceived.addListener(_enableFullCORS, {urls: ["*://*/*"]}, ["blocking", "responseHeaders"]);
	// 1.2 - Make sure we listen for setting Update
	const updateSetUpData = () => {
		return new Promise(function (resolve, reject) {
			const _handleSetUp = (msg) => {
				if (msg.action === "SetUpData") {
					port.onMessage.removeListener(_handleSetUp);
					// actual work here
					Object.assign(settings, msg.data.settings);
					jobProgress = msg.data.jobProgress;
					Object.assign(pageMods, msg.data.pageMods);
					// let other work continue
					// new extra - resize window if needed
					browser.windows.getCurrent().then(winObj=>{
						console.log("Got windowObj -- resizing");
						const topBarH = 70; // pixels; guessed it, not sure.
						browser.windows.update(winObj.id, {height: settings.browserWindowSize.h + topBarH, width: settings.browserWindowSize.w}).then(resolve, reject);
					});
					// a good place to start intercepting Response Headers -- to allow for 'eval' when CSP is set
					browser.webRequest.onHeadersReceived.addListener(_enableEvalModifCSP, {urls: ["*://*/*"]}, ["blocking", "responseHeaders"]);
					// resolve();
				}
			};
			port.onMessage.addListener(_handleSetUp);
			port.postMessage({
				"action": "GetSetUpData"
			});
		});
	};
	// 1.3 - Ask server/messenger to clean up job progress after preVisiting
	const cleanUpJobProgress = ()=>{
		return new Promise(function(resolve, reject) {
			const _handleCleanUp = (msg) => {
				if (msg.action === "CleanUpProgress.confirmed") {
					port.onMessage.removeListener(_handleCleanUp);
					resolve();
				}
			};
			port.onMessage.addListener(_handleCleanUp);
			port.postMessage({
				"action": "CleanUpProgress"
			});
		});
	};
	port.postMessage({
		action: "SetUpFinished"
	}); // doesn't do anything - just talking to the App
	// 1.4 timers // TODO: create a clean-up F for timers <-- remove handlers
	listenForTimers(); // We should call it before any of the work loading
	// listenForFetch();
	// 1.5 - Set up handling requests for iframe ids
	const ifrIdCleanUpF = setUpIFrameIdQueryHandling();
	// 2 - Actual work
	if (settings.preVisitingNeeded) {
		try {
			await launchPagePrevisiting(jobProgress, port);
			await cleanUpJobProgress();
			await updateSetUpData(); // re-read pageMods and jobProgress			
		} catch (err) {
			throw err;
		}
	}
	const postPrevisitWorkExists = (settings.screenshotsNeeded || settings.pageVarsNeeded || settings.contentScrambledScreenshotsNeeded);
	if (postPrevisitWorkExists){
		doPostPrevisitWork(settings, jobProgress, pageMods, port).then(() => {
			console.log("We are done processing everything");
			// global clean-up
			browser.gTab.stopResizingBrowserTabsTo();
			browser.webRequest.onHeadersReceived.removeListener(_enableEvalModifCSP);
			browser.webRequest.onHeadersReceived.removeListener(_enableFullCORS);
			ifrIdCleanUpF();
			browser.browserAction.enable();
		});
	}
}

function prefixSrc(src, type) {
	var path;
	switch (type) {
		case "shared":
			path = "sharedScripts/" + src;
			break;
		case "main":
			path = "mainScripts/" + src;
			break;
		case "previsit":
			path = "previsitScripts/" + src;
			break;
		case "css":
			path = "css/" + src;
			break;
		default:
			throw new Error("Unknown type of content script -- probably a typo", type);
	}
	return "/client/" + path;
}

function _createDatSaveHandler(action, portToApp) {
	return (msg, sender, respF) => {
		if (msg.action === action) {
			if(msg.urlId === undefined){
				console.error("No urlId given when forwarding to the Messenger App --> bypassing, ", action);
				return false;
			}
			// and wait for a confirmation of the data handled
			const _waitForConf = (confMsg) => {
				if (confMsg.action === action + ".confirmed" && confMsg.data.urlId === msg.urlId) {
					respF(confMsg); // receive this MSG in content script
					portToApp.onMessage.removeListener(_waitForConf);
				}
			};
			portToApp.onMessage.addListener(_waitForConf);
			// forward data to the App
			portToApp.postMessage(msg);
			return true; // so the Content Script keeps waiting for respF to be called, instead of proceeding right away
		}
		return false;
	};
}

function _hostFromUrl(aUrl) {
	var parsedURL = /^(\w+)\:\/\/([^\/]+)\/(.*)$/.exec(aUrl);
	var frameHost;
	if (!parsedURL) {
		if (__debug) {
			console.warn("No 'http[s] iframe url: ", aUrl, "; ==> Returning full aUrl");
		}
		frameHost = aUrl;
	} else {
		[, , frameHost] = parsedURL;
	}
	return frameHost;
}

function createRRequestHandler(requestAction, portToApp){
	// NOTE: This F can be quickly transformed in a generic 2-way communication channel between Content and BackEnd <-- requestAction already serves this purpose
	const replyAction = requestAction + ".Reply";
	const cbStore = {};
	const MAX_R_WAIT = 20000; // ms
	// 1 - Listen for Requests from Content SCripts
	const reqListener = (msg, sender, respF)=>{
		if(msg.action === requestAction){
			const aPr = new Promise(function(resolve, reject) {
				var _resolved = false;
				cbStore[msg.urlId] = d => {
					if(_resolved){
						console.error("R took longer than MAX_R_WAIT, but still resolved successfully --> Optimize r code?..");
					}
					_resolved = true;
					resolve(d);
				};
				// 1.1 - Set a timeout - to know if R stalled the whole process
				setTimeout(function(){
					if(_resolved){
						return; // do nothing
					}
					console.error("R took too long to respond -- timed out.", msg);
					reject("R took too long to respond -- timed out.");
				}, MAX_R_WAIT);
			});
			portToApp.postMessage(msg);
			return aPr;
		}
		return false;
	};
	browser.runtime.onMessage.addListener(reqListener);
	// 2 - Set up msg forwarding from messenger.js to Content Scripts
	const replyListener = msg => {
		if (msg.action === replyAction){
			const cb = cbStore[msg.data.urlId];
			if(cb === undefined){
				console.error("R replied, but there is no handler for it", msg.action, msg.data.urlId);
				return;
			}
			cb(msg.data.data); // forward data to Content Script
		}
	};
	portToApp.onMessage.addListener(replyListener);
	// 3 - Return a clean-up function
	return () =>{
		browser.runtime.onMessage.removeListener(reqListener);
		portToApp.onMessage.removeListener(replyListener);
	};
}

// TODO: Extract stand-alone functions in their files away from this giant file
function setUpIFrameIdQueryHandling(){
	// a global handler; Replies with a FrameId, so the requesting iframe can be later identified during visibility checking
	const _frameIdRqHandler = (msg, sender) =>{
		if(msg.action === "TellMeMyMachineIframeId"){
			console.assert(sender.frameId !== 0, "Main Content Windows shouldn't be asking for a frameID");
			return Promise.resolve({"action": "HaveYourMachineId", machineFrameId: sender.frameId});
		}
		return false;
	};
	browser.runtime.onMessage.addListener(_frameIdRqHandler);
	return ()=>browser.runtime.onMessage.removeListener(_frameIdRqHandler); // clean-up function
}

function doPostPrevisitWork(settings, jobProgress, pageMods, portToApp) {
	// All params are shared across functions - no need to put them on stack - we may get very deep in recursions
	browser.gTab.startResizingBrowserTabsTo(settings.browserWindowSize.w, settings.browserWindowSize.h); // doing it after previsiting - otherwise DevTools freeze
	var _workerCounter = 0; // A semaphore
	const scriptsToLoadArr = [prefixSrc("main.js", "main"), prefixSrc("main.load.js", "main")];
	// prefixSrc("jquery-3.5.1.js", "shared"), prefixSrc("load.control.js", "shared"), prefixSrc("helper.js", "main"), prefixSrc("img.processing.js", "main"), prefixSrc("color.js", "main"), prefixSrc("page.params.js", "main"), prefixSrc("dom.processing.js", "main"), prefixSrc("scramble.js", "main"),  -- already loaded
	
	// 1 - Set up Global msg handlers - just forwarding data to the Messenger
	const glMsgHandlerArr = ["SaveImg", "SaveImgArr", "SaveTxt", "SaveTxtArr", "MarkPageDone"].map(action => {
		return _createDatSaveHandler(action, portToApp);
	});
	
	// 2 - Assign global msg handlers
	glMsgHandlerArr.forEach(handler=>{
		browser.runtime.onMessage.addListener(handler);
	});
	
	// 2.1 - Set up R command forwarding/handlers
	const rCommCleanUpF = createRRequestHandler("RequestRAction", portToApp);
	
	// 3 - A clean up f for global handlers <-- Not sure why I bother - just close the browser...
	function glCleanUp(){
		glMsgHandlerArr.forEach(handler=>{
			browser.runtime.onMessage.removeListener(handler);
		});
		rCommCleanUpF();
		// ifrIdCleanUpF();
	}

	// a slimmed-down version of createOnePageProcessor for iFrames
	function createIFrameProcessor(ifrParams) {
		const {_tabId, _frameId, _urlId, _frameUrl, _frameSize, _portToApp} = ifrParams;
		// NOTE: here we are already sure the iframe has loaded all Content scripts in it
		// -1 - Calc frameUrl hostname
		const frameHost = _hostFromUrl(_frameUrl);
		const parentHost = _hostFromUrl(_urlId);
		// 0 - Here we are sure iframe exists and loaded
		// const scriptsIFrToLoadArr = [prefixSrc("jquery-3.5.1.js", "shared"), prefixSrc("load.control.js", "shared"), prefixSrc("helper.js", "main"), prefixSrc("img.processing.js", "main"), prefixSrc("color.js", "main"), prefixSrc("page.params.js", "main"), prefixSrc("dom.processing.js", "main"), prefixSrc("scramble.js", "main"), prefixSrc("main.iframe.js", "main")];
		const msgHandlerArrIFr = [];
		const urlIdIFr = [parentHost, _frameId, frameHost].join("_");
		const iFrameReadyPromise = new Promise(function (resolve, reject) {
			// 1 - Set-up handlers for urlId, settingsObj and modF delivery
			// const tabIdListener = (msg, sender, respF) => {
			// 	if (msg.action === "giveMeTabId_iframe" && _tabId === sender.tab.id && sender.frameId === _frameId) {
			// 		respF({
			// 			"action": "haveYourTabId_iframe",
			// 			"tabId": _tabId,
			// 			"parentFrameUrlId": _urlId, // it's a bit of a mess with naming, but I'm too lazy to clean up
			// 			"urlId": urlIdIFr,
			// 			"frameSize": _frameSize,
			// 			settings: settings
			// 		});
			// 		resolve();
			// 	}
			// };
			// msgHandlerArrIFr.push(tabIdListener);
			// browser.runtime.onMessage.addListener(tabIdListener);
			// // 2 - Inject the scripts
			// _execScripts(_tabId, scriptsIFrToLoadArr, "document_end", _frameId).catch((err)=>{
			// 	console.error("We couldn't inject frame-manipulation scripts in an iframe, ", _frameUrl, " ===> ", _urlId, "_frameId: ", _frameId, "err: ", err);
			// 	reject(err);
			// });
			// 2 - Instead of injecting scripts, just let the script know we are working with it
			browser.tabs.sendMessage(_tabId, {
				"action": "haveYourTabId_iframe",
				"tabId": _tabId,
				"parentFrameUrlId": _urlId, // it's a bit of a mess with naming, but I'm too lazy to clean up
				"urlId": urlIdIFr,
				"frameSize": _frameSize,
				settings: settings
			}, {
				frameId: _frameId
			}).then(function(msg){
				console.assert(msg.action === "receivedMyTabId_iframe", "A frame should respond with a 'receivedMyTabId_iframe' msg action to tabId data, but instead it said:", msg.action, "urlId:", msg.urlId);
				resolve();
			});
		});

		function _doAfterIframeRead(cb) {
			return iFrameReadyPromise.then(function () {
				// This is overcomplicated, but I want to proceed after 5s if Content Script hasn't finished - so nothing is held up <-- But how do I make a note of this and explore it later?...
				return new Promise(function (resolve, reject) {
					var _resolved = false;
					cb(function () {
						if (_resolved) {
							return; // the timeout has already fired - skipping calling a resolve
						}
						_resolved = true;
						resolve();
					}, (e)=>{
						return reject(e);
					});
					// a timeOut - in fringe cases when we have a redirect or smth failed while running in Content Scripts - so it doesn't hold up everything else
					
					// TEMPORARILY DISABLE FOR DEBUG
					
					// window.setTimeout(function () {
					// 	if(_resolved) {
					// 		return;
					// 	}
					// 	console.error("an Iframe function have timed out.");
					// 	_resolved = true;
					// 	resolve();
					// }, 9000); // 5s seems enough
				});
			}).catch((err)=>{
				console.error("IFrame failed to load ==> Skipping any modifications to it");
				return Promise.reject(err);
			});
		}
		var __paramsSaved = false;
		return {
			prepIFrameDom: function(){
				return _doAfterIframeRead(function (resolve, reject) {
					browser.tabs.sendMessage(_tabId, {
						"action": "PrepIFrameDom",
						"urlId": urlIdIFr
					}, {
						frameId: _frameId
					}).then(function () {
						console.log("IFrame DOM Prepped", urlIdIFr);
						resolve();
					}).catch((e)=>{
						return reject(e);
					});
				});
			},
			houseKeepIFrameDom: function(){
				return _doAfterIframeRead(function (resolve, reject) {
					browser.tabs.sendMessage(_tabId, {
						"action": "houseKeepIFrameDom",
						"urlId": urlIdIFr
					}, {
						frameId: _frameId
					}).then(function () {
						console.log("IFrame DOM HouseKeeped", urlIdIFr);
						resolve();
					}).catch(reject);
				});
			},
			saveParamsAndImg: function () {
				return _doAfterIframeRead(function (resolve, reject) {
					// a - fool check
					if (__paramsSaved) {
						console.error("We have already called saveParamsAndImg for this iframe, ", urlIdIFr, '==> resolving right away');
						return resolve();
					}
					__paramsSaved = true;
					// a - Assign handlers
					// NOTE: we don't need data handlers here - we piggyback on the main frame handlers
					// b - signal to the frame to do the work
					browser.tabs.sendMessage(_tabId, {
						"action": "ProcessIFrameParams",
						"urlId": urlIdIFr
					}, {
						frameId: _frameId
					}).then(function(){
						console.log("Finished processing an iframe", urlIdIFr);
					}).then(resolve).catch((e)=>{
						console.error("saveParamsAndImg failed: ", e);
						reject(e);
					});
				});
			},
			scrambleIFrame: function (scrambleMethod) {
				return _doAfterIframeRead(function (resolve, reject) {
					browser.tabs.sendMessage(_tabId, {
						"action": "ScrambleIFrame",
						scrambleMethod: scrambleMethod,
						"urlId": urlIdIFr
					}, {
						frameId: _frameId
					}).then(function () {
//						console.log("IFrame scrumbled", urlIdIFr);
						resolve();
					}).catch(reject);
				});
			},
			restoreIFrame: function (scrambleMethod) {
				return _doAfterIframeRead(function (resolve, reject) {
					browser.tabs.sendMessage(_tabId, {
						"action": "RestoreIFrame",
						scrambleMethod: scrambleMethod,
						"urlId": urlIdIFr
					}, {
						frameId: _frameId
					}).then(function () {
//						console.log("IFrame restored", urlIdIFr);
						resolve();
					}).catch(reject);
				});
			},
			cleanUp: function () {
				msgHandlerArrIFr.forEach(f => browser.runtime.onMessage.removeListener(f));
			}
		};
	}

	function createOnePageProcessor() {
		return new Promise((resolve, reject) => {
			// 0 - Basic setups
			let loadedOnce = false, loadedTwice = false;
			var _prematureTabClosingFlag = true;
			var aTab;
			const iFrameProcessors = [];
			const iFrameLoadedTracker = {};
			// 1 - Find and reserve a urlObj
			const aUrlObj = jobProgress.find(x => !x.allDone && !x._beingProcessed);
			if (aUrlObj === undefined) { // fool check
				let err = "We can't be here - having a fresh urlObj to process should be ensured upstream";
				console.error(err);
				reject(err);
			}
			aUrlObj._beingProcessed = true; // book this object, so other workers don't grab <-- I hope js functions don't switch before they finish
			// 1.1 - Prep a clean-up function
			const cleanUp = () => {
				// We are all done with a Webpage - clean up listeners
				browser.tabs.onRemoved.removeListener(handleTabClose);
				msgHandlerArr.forEach(f => browser.runtime.onMessage.removeListener(f));
				browser.webNavigation.onCompleted.removeListener(handleOnComplete);
				browser.webNavigation.onCompleted.removeListener(iframeLoadedHandler);
				browser.webNavigation.onErrorOccurred.removeListener(iframeLoadedHandler);
				browser.webRequest.onHeadersReceived.removeListener(pageFailHandler);
				// release booked objects
				aUrlObj._beingProcessed = false;
				aUrlObj.allDone = true;
				_workerCounter--;
				// clean up within iFrames
				iFrameProcessors.forEach(x => x.cleanUp());
				// resolve, which should start the next cycle/webpage
				// TODO close the tab
				resolve();
			};
			// 1.2 - Tracking iframe loading - so we know when our Content Scripts have definitely run there
			const iframeLoadedHandler = (details) =>{
				if(iFrameLoadedTracker[details.tabId] === undefined){
					iFrameLoadedTracker[details.tabId] = {};
				}
				// iFrameLoadedTracker[details.tabId][details.frameId] = true;
				iFrameLoadedTracker[details.tabId][details.frameId] = details.url || true;
			};
			// browser.webNavigation.onErrorOccurred.addListener((details)=>{
			// 	console.error("[onErrorOccurred] details:", details);
			// });
			browser.webNavigation.onErrorOccurred.addListener(iframeLoadedHandler); // For some reason Google Ads show navigation error and then write their body dynamically, also masking themselves as the host page <== I don't know if this error swallowing can cause troubles down the line
			browser.webNavigation.onCompleted.addListener(iframeLoadedHandler);
			// 2 - Set up handlers for dataSaving messages - they will carry a urlId with them
			// NOTE: we use global handlers for ["SaveImg", "SaveImgArr", "SaveTxt", "SaveTxtArr"] -- they are the same everywhere, so no need for a F for each tab
			const msgHandlerArr = [];
			const allDoneHandler = (msg, sender, respF) => { // an extra handler for MarkPageDone (besides telling the messenger) -- to save html if needed
				if(msg.action === "MarkPageDone" && msg.urlId === aUrlObj.url){
					_prematureTabClosingFlag = false;
					(() => {
						// Save HTML if needed
						if (settings.htmlNeeded) {
							// return new Promise(()=>{}); // JUST WAITING
							console.log("Going to save html");
							return window._initSaveHtml(aTab.id).then((htmlStrings) => {
								// forward strings to the Messenger
								return portToApp.postMessage({
									"action": "SaveTxt",
									"dat": htmlStrings.join(""),
									"urlId": aUrlObj.url,
									"folders": ["pageHtml"],
									"name": aUrlObj.url.split("://")[1].split("/")[0],
									"type": "html"
								});
							});
						}
						// if HTML not needed, just proceed
						return Promise.resolve();
					})().finally(() => {
						// all done; close the tab - this will trigger a clean up and next cycle
						browser.tabs.remove(aTab.id).catch(reject); // if aTab.id is undefined, we deserve an exception
					});	
				}
			};
			
			msgHandlerArr.push(allDoneHandler);
			// 2.5 - Set-up handlers to register iFrames loading
			function waitForIframes() {
				return new Promise(function (_resolve, reject) {
					var nIFrames;
					var alreadyResolved = false;
					const webNavigationListeners = [];
					const workableIFrameArr = [];
					function resolve(){
						// do some housekeeping before resolving
						webNavigationListeners.forEach(f=>{
							browser.webNavigation.onCompleted.removeListener(f);
						});
						// update iframe urls in workableIFrameArr - they may have changed during the wait for them to load
						return browser.webNavigation.getAllFrames({
							tabId: aTab.id
						}).then((newFrArr)=>{
							// tmp diagnostics
							const _nonloadedIframes = newFrArr.filter(ifr=>ifr.frameId).filter(ifr=> workableIFrameArr.every(oldFr=>oldFr.frameId!==ifr.frameId));
							if(_nonloadedIframes.length){
								console.warn("Non-loaded frames:", _nonloadedIframes);
								console.warn("Workable Iframes:", workableIFrameArr);
							}
							// checking for iframes that no longer exist
							const workableIFrameArrTMP = workableIFrameArr.filter(ifr=>{
								const ifrExists = newFrArr.some(newFr=>newFr.frameId===ifr.frameId);
								if(!ifrExists){
									console.error("IFRAME no longer exists: ", ifr);
								}
								return ifrExists;
							});
							// NOTE: should we add new iframes?... just presuming they all loaded?
							// end tmp diagnostics
							_resolve(workableIFrameArrTMP);
						});
					}
					function __handleOneFrLoaded(_tabId, _frameId, _frameUrl){
						return window.ensureIFrameRunContentScriptAsync(_tabId, _frameId)
							.then(()=>{
								return browser.tabs.sendMessage(_tabId, {
									"action": "haveYouLoaded_iframe"
								}, {
									frameId: _frameId
								});
							})
							.then(function(msg){
								console.assert(msg.action === "IFrameLoaded", "A frame should respond with a 'IFrameLoaded' msg action to the haveYouLoaded_iframe request, but instead it said:", msg.action, "url:", msg.url, "msg: ", msg);
								workableIFrameArr.push({frameId: _frameId, url: _frameUrl});
							})
							.catch(e=>{
								console.warn("IFrame failed to respond -- possibly no longer exists And/Or Couldn't manually inject a script:", e);
							})
							.finally(()=>{
								nIFrames--;
								if (!nIFrames && !alreadyResolved) {
									alreadyResolved = true;
									// console.log("ALL FRAMES LOADED, not timed out");
									resolve(workableIFrameArr);
								}	
							});
					}
					browser.webNavigation.getAllFrames({
						tabId: aTab.id
					}).then(function (iFrArr) {
						// TODO: DISABLE after debug
						// iFrArr = iFrArr.filter(ifr=>[-1, 0].includes(ifr.parentFrameId));// because devtools hungs on unresolved promises -- while waiting <-- Remove later
						nIFrames = iFrArr.length - 1; // -1 because one of the frame is "main"
						if (!nIFrames) {
							return resolve();
						}
						// TMP diagnostics
						console.warn("Frames returned by webNavigation.getAllFrames", iFrArr);
						// Trigger script runs in iframes
						iFrArr.forEach((frObj) => {
							if (frObj.frameId) { // we avoid loading the script in the main frame
								if(iFrameLoadedTracker[aTab.id][frObj.frameId] !== undefined){ // if iframe's DOM has loaded - send a signal
									console.log("[__handleOneFrLoaded] frObj.frameId", frObj.frameId, "frObj.url", frObj.url);
									__handleOneFrLoaded(aTab.id, frObj.frameId, frObj.url);
								}else{ // else, wait for it to load, with a global timeout
									// TODO: test how this branch runs
									(function(_tabId, _frameId, _frameUrl){
										const _hasLoadedHandler = (details)=>{
											if(details.tabId === _tabId && details.frameId === _frameId){
												__handleOneFrLoaded(_tabId, _frameId, _frameUrl);
											}
										};
										webNavigationListeners.push(_hasLoadedHandler);
										browser.webNavigation.onCompleted.addListener(_hasLoadedHandler);
									})(aTab.id, frObj.frameId, frObj.url);
								}
							}
						});
						// handle situations when iFrames didn't load successfully, or didnt' talk back to BG
						setTimeout(function () {
							if (!alreadyResolved) {
								alreadyResolved = true;
								console.error("iFrames failed to load and timeout out --> continuing anyway; Loaded frames:", iFrameLoadedTracker[aTab.id]);
								resolve();
							} // else ignore
						}, settings.iframeLoadTimeout);
					}).catch((err)=>{
						console.error("Omnibus ERR while waiting for iframes to load: ", err);
						reject();
					});
				});
			}
			
			const iFramesLoadedReqListener = (msg, sender) => {
				if (msg.action === "HaveIFramesLoaded?" && aTab !== undefined && aTab.id === sender.tab.id) {
					var iFrArr;
					// wait for all iFrames to load
					waitForIframes().then(function (workableIFrameArr) {
						iFrArr = workableIFrameArr;
						if (!iFrArr.length || !settings.iframeHandlingNeeded) { // No need for extra work if neither page data, no scrambled screenshots are needed"main"
							return Promise.resolve();
						}
						// asking for visible iframes - in case they were hidden by opacity or visibility or smth else
						return browser.tabs.sendMessage(aTab.id, {
							"action": "GiveMeIFrameVisibility"
						});
					}).then(function (respMsg) {
						if(respMsg===undefined){
							// no iframes to process - just skip to the next step
							return Promise.resolve();
						}
						console.assert(respMsg.action === "HaveYourIFrameVisibility");
						const {
							visFrInfoArr,
							mainFrameUrl
						} = respMsg;
						console.log("Visible frame urls:", visFrInfoArr, "BG getAllFrames: ", iFrArr.map(x=>x.url));
						// filtering out the main window frame
						iFrArr = iFrArr.filter(aFr=>aFr.frameId !== 0);
						// Filter iframes down to visibile only, and let them know their true sizes
						const visIfrArr = iFrArr.filter(aFr=>{
							if(visFrInfoArr.every(ifrInfo=>ifrInfo.machineFrameId !== aFr.frameId)){
								console.log("[BG] Invisible iframe:", aFr);
								return false;
							}
							return true;
						}).map(aFr=>{
							aFr.size = visFrInfoArr.find(ifrInfo=>ifrInfo.machineFrameId === aFr.frameId);
							return aFr;
						});
						// Create a processor for each iframe
						visIfrArr.forEach(frObj => {
							const ifrParamObj = {_tabId: aTab.id, _frameId: frObj.frameId, _urlId: aUrlObj.url, _frameUrl: frObj.url, _frameSize: frObj.size, _portToApp: portToApp};
							iFrameProcessors.push(createIFrameProcessor(ifrParamObj));
						});
						debugger;
					}).catch((err) => {
						console.error("SHOWING ERROR, from br.main.js:", JSON.stringify(err));
						if (settings.debug) {
							throw err;
						}
					}).finally(() => {
						// tell the main Content Script it can go ahead
//						console.log("SENDING IFramesLoaded signal");
						browser.tabs.sendMessage(aTab.id, {
							"action": "IFramesLoaded"
						});
					});
				}
			};
			msgHandlerArr.push(iFramesLoadedReqListener);
			// 2.6 - Run iframe processing when a tab asks for it
			const prepIFramesListener = (msg, sender) => {
				if (msg.action === "PrepIFrames" && msg.urlId === aUrlObj.url) {
					return Promise.allSettled(iFrameProcessors.map(x => x.prepIFrameDom())).then(__scanAllSettledForRejects("iFrameProcessors PrepIFrames"));
				}
			};
			const houseKeepIFramesListener = (msg, sender) => {
				if (msg.action === "HouseKeepIFrames" && msg.urlId === aUrlObj.url) {
					return Promise.allSettled(iFrameProcessors.map(x => x.houseKeepIFrameDom())).then(__scanAllSettledForRejects("iFrameProcessors HouseKeepIFrames"));
				}
			};			
			const processIFramesListener = (msg, sender) => {
				if (msg.action === "ProcessIFrames" && msg.urlId === aUrlObj.url) {
					return Promise.allSettled(iFrameProcessors.map(x => x.saveParamsAndImg())).then(__scanAllSettledForRejects("iFrameProcessors saveParamsAndImg"));
				}
			};
			const scrambleIFramesListener = (msg, sender) => {
				if (msg.action === "ScrambleIFrames" && msg.urlId === aUrlObj.url) {
					return Promise.allSettled(iFrameProcessors.map(x => x.scrambleIFrame(msg.scrambleMethod))).then(__scanAllSettledForRejects("iFrameProcessors scrambleIFrame"));
				}
			};
			const restoreIFramesListener = (msg, sender) => {
				if (msg.action === "RestoreIFrames" && msg.urlId === aUrlObj.url) {
					return Promise.allSettled(iFrameProcessors.map(x => x.restoreIFrame(msg.scrambleMethod))).then(__scanAllSettledForRejects("iFrameProcessors restoreIFrame"));
				}
			};
			msgHandlerArr.push(prepIFramesListener);
			msgHandlerArr.push(processIFramesListener);
			msgHandlerArr.push(scrambleIFramesListener);
			msgHandlerArr.push(restoreIFramesListener);
			msgHandlerArr.push(houseKeepIFramesListener);
			// 3 - Set-up handlers for urlId, settingsObj and modF delivery
			const tabIdListener = (msg, sender, respF) => {
				if (aTab === undefined) {
					return;
				} // it's a call from a different tab - ours isn't alive yet
				if (msg.action === "giveMeTabId" && aTab.id === sender.tab.id) {
					//TODO: SET the full-page window height -- resizeCurrTabF
					// NOTE: we can't change window height -- CSS/styling may depend on it -- saving screenshots without sticky bottom menus instead
					// debugger;
					// if(msg.pageScrollHeight > settings.browserWindowSize.h && settings.fullLengthScreenshot){
					// 	browser.gTab.makeTabFullHeight(msg.pageTitleId, msg.pageScrollHeight);
					// } // otherwise no point changing anything
					respF({
						"action": "haveYourTabId",
						"reloadAfter1stLoad": !loadedTwice,
						"tabId": aTab.id,
						"urlId": aUrlObj.url,
						settings: settings
					});
				}
			};
			msgHandlerArr.push(tabIdListener);
			// 3.1 - Separate handlers for pageMods -- they are needed very early
			const pageModsListener = (msg, sender)=>{
				if(msg.action === "GiveMePageMods" && aTab !== undefined && aTab.id === sender.tab.id){
					return Promise.resolve({"action": "HaveYourPageMods", pageModF: pageMods[aUrlObj.url].toString()});
				}
				// return false;
			};
			msgHandlerArr.push(pageModsListener);
			// 4 - Handle tab closing - if it closes before we had the data, the URL should be removed, since smth bad happened, like to response -- Including 404 and 500 cases
			const handleTabClose = (closedTabId) => {
				if (aTab === undefined) {
					return;
				} // it's a call from a different tab - ours isn't alive yet
				if (closedTabId === aTab.id) {
					if (_prematureTabClosingFlag) {
						// remove this url from progress, and save everything downstream ==> just fire a relevant event, so some other code handles it elsewhere
						aUrlObj._aborted = true; // Not used/saved for now
						// browser.runtime.sendMessage({
						// 	"action": "banishPage",
						// 	urlId: aUrlObj.url
						// }); // NOTE: we don't have/need a handler for this -- just call app/port directly
						portToApp.postMessage({
							action: "RemovePage",
							urlId: aUrlObj.url
						});
						console.log("[BR.Main] Removing a URL from processing, ", aUrlObj.url);
						// NOTE: I don't wait for a confirmation, so if a browser is closed immediately after, the operation may not have finished <-- let's hope it never happens...
					}
					cleanUp(); // Clean up takes care of not processing this URL anymore
					resolve(); // resolve no matter what - we are done with this page
				} // else ignore - it's not about our tab
			};
			// 5 - use webNavigation.onCompleted event to attach our script - it'll re-attach in the case of 301/2
			const handleOnComplete = (details) => {
				if (aTab === undefined) {
					return;
				} // it's a call from a different tab - ours isn't alive yet
				if (details.tabId === aTab.id && details.frameId === 0) {
					// a dumb hack for ensuring all images load -- reloading a page once
					let nTimes = "more than twice";
					if(!loadedOnce){
						loadedOnce = true;
						nTimes = "once";
					}else if(!loadedTwice){
						loadedTwice = true;
						nTimes = "twice";
					}
					console.log("BR.MAIN tracking REloading -- loaded %c%s.", "color:pink;font-weight: bold;", nTimes);
					// 5.1 - Attach our script here <== The last step, so we are sure all listeners are set up by this point
					_execScripts(aTab.id, scriptsToLoadArr, "document_end")
						.catch(err=>{
							console.error("Couldn't inject Content Scripts ==> auto closing the tab and moving on to the next url, ", aUrlObj.url);
							browser.tabs.remove(aTab.id).catch(reject);
						});
				}
			};
			// 6 - Setup a 1m timeout - if no response after a minute, presume it's all dead ==> close the tab, tell App to banish a Url
			// NOTE: Disable for debug, so we can work on a page
			if (_closeDeadTabsAfter1Min) {
				window.setTimeout(function () {
					if(aUrlObj.allDone){
						// all things finished correctly
						return;
					}
					if (aTab === undefined) {
						return console.error("No tab object, and no page after a while... Smth is seriously wrong.", aUrlObj.url);
					}
					browser.tabs.remove(aTab.id).catch(reject);
				}, 80000);
			}
			// 7 - Assign event/msg handlers
			msgHandlerArr.forEach(f => browser.runtime.onMessage.addListener(f));
			browser.tabs.onRemoved.addListener(handleTabClose);
			browser.webNavigation.onCompleted.addListener(handleOnComplete);
			// NOTE: I deliberately do not handle onErrorOccurred - a) if I press "stop loading", I'm watching the extension; b) if it's a network error, I don't want it to be quetly swallowed (maybe it's my fault, etc.) - and I don't feel like adding a robust logging/state-recover system just now
			// 8 - Handling 404/500 results automatically
			const pageFailHandler = (details)=>{
				if(aTab && aTab.id === details.tabId && details.frameId === 0){ // only requests in this tab, in main frame
					// console.log("[pageFailHandler] documentUrl:", details.documentUrl, "originUrl:", details.originUrl, "details.statusCode:", details.statusCode, "type: ", details.type);
					if(details.documentUrl === undefined){ // top-level document only
						if(details.statusCode >= 400){
							console.error("[pageFailHandler] Page failed to load, Removing it from future Processing (jobProgress), documentUrl:", details.documentUrl, "originUrl:", details.originUrl, "type: ", details.type);
							browser.tabs.remove(aTab.id).catch(reject); //Removing "prematurely" does the trick
						}
					}
				}
			};
			browser.webRequest.onHeadersReceived.addListener(pageFailHandler, {urls: ["*://*/*"]});
			// 9 - Create a tab
			browser.tabs.create({
				url: aUrlObj.actualUrl
			}).then(function (_aTab) {
				aTab = _aTab;
				// run some things as early as possible
				// _execScripts(aTab.id, scriptsToLoadArr, "document_end").catch(err=>{
				// 	console.error("Couldn't inject Content Scripts ==> auto closing the tab and moving on to the next url, ", aUrlObj.url);
				// 	browser.tabs.remove(aTab.id).catch(reject);
				// });
				// browser.tabs.executeScript(aTab.id, {
				// 	file: prefixSrc("early.page.mods.js", "shared"),
				// 	runAt: "document_start",
				// 	matchAboutBlank: true,
				// 	allFrames: true
				// }).catch(err=>{
				// 	console.error("Couldn't inject early.page.mods Scripts ", JSON.stringify(err));
				// });
				
				_execScripts(aTab.id, [prefixSrc("early.page.mods.js", "shared")], "document_start").catch(err=>{
					console.error("Couldn't inject early.page.mods Scripts ", JSON.stringify(err));
				});
				// here all is setup - just wait for navigation to complete
			}).catch(reject);
		});
	}
	
	return new Promise((glResolve, glReject)=>{
		function launchScreenShotting() {
			// Note: We've moved data Saving handlers downsream, so we have access to a selected urlObj and can update it
			if (jobProgress.some(x => !x.allDone)) {
				// fresh urlObj to process are available - keep working and launching workers
				while (_workerCounter < settings.pagesOpenAtOnce) {
					_workerCounter++;
					createOnePageProcessor().then(launchScreenShotting); // Here is where recursion lives
				}
			} else if (jobProgress.some(x => x._beingProcessed)) {
				// some workers are still finishing their pages --> wait for them to resolve their Promise
				return;
			} else {
				glCleanUp(); // removing global msg handlers
				// all done
				glResolve();
			}
		}
		launchScreenShotting();
	});
}

function _createConfHandler(confirmedAction, portToUnlisten, forwardConfF) {
	confirmedAction = confirmedAction + ".confirmed";
	const _waitForConf = (confMsg) => {
		if (confMsg.action === confirmedAction) {
			if (forwardConfF) {
				forwardConfF(confMsg);
			}
			portToUnlisten.onMessage.removeListener(_waitForConf);
		}
	};
	return _waitForConf;
}

async function launchPagePrevisiting(jobProgress, portToApp) {
	// 1 - Get a list of sites to previsit
	const subProgressArr = jobProgress.filter(x => x.previsitingDone === false);
	// 2 - TODO set up event handlers on tabs - we'll have urlId passed to us, so we know what to update
	const handlePageBanish = (msg, sender, respF) => {
		if (msg.action === "banishPage") {
			// Wait for a confirmation form the App and forward it to the page script - which then initiates a new cycle
			portToApp.postMessage({
				action: "RemovePage",
				urlId: msg.urlId
			});
			portToApp.onMessage.addListener(_createConfHandler("RemovePage", portToApp, respF));
		}
	};
	const handlePrevisitData = (msg, sender, respF) => {
		if (msg.action === "savePrevisitF") {
			portToApp.postMessage({
				action: "SavePageScript",
				urlId: msg.urlId,
				funcAsStr: msg.f,
				newHref: msg.href
			});
			portToApp.onMessage.addListener(_createConfHandler("SavePageScript", portToApp, respF));
		}
	};
	browser.runtime.onMessage.addListener(handlePageBanish);
	browser.runtime.onMessage.addListener(handlePrevisitData);

	//	// 3 - Run url Previsiting one by one
	for (let aUrlObj of subProgressArr) {
		try {
			let _urlDone = await preVisitAPage(aUrlObj);
			if (!_urlDone) {
				// check if the tab was closed without any handling - this means we had a dramatic failure and closed the tab ==> remove the page from future processing
				// NOTE: This is Async, so if it's the last page to process, the removal may not be saved
				portToApp.postMessage({
					action: "RemovePage",
					urlId: aUrlObj.url
				});
			}
		} catch (e) {
			throw e; // Should we simply exclude this url? If errors are relatively common, we'll do it.	
		}
	}
	// here we are sure to have done all pages ==> proceed to the next step
	// 4 - clean up
	browser.runtime.onMessage.removeListener(handlePageBanish);
	browser.runtime.onMessage.removeListener(handlePrevisitData);
	// 5 - Re-read page mods and jobProgress - so we have the latest copy :NOTE: we do it upstream
}

function preVisitAPage(aUrlObj) {
	// NOTE: I dislike assigning and then removing handlers - we better assign once, and keep checking which tabID corresponds to which URL, and what's the state there
	// (the only headache in such case is preserving the state - we don't have the luxury of a function scope and have to keep a bunch of id- and url-specific switches) ==> We'll try having a state object elsewhere, here we keep handler madness
	// Promises - rubbish; Async-Await - Great; Callbacks - tolerable.
	var _urlDone = false;
	if (!aUrlObj) {
		// TODO: no urls to previsit left --> handle accordingly
		throw new Error("Need a url to handle");
	}
	console.log("[PREVISITING] %c a page: " + aUrlObj.url, "color:yellowgreen;");
	// 7 use webNavigation.onCompleted event to attach our script - it'll re-attach in the case of 301/2
	var _tabId;
	const handleOnComplete = (details) => {
		if (details.tabId === _tabId && details.frameId === 0) {
			// 8 - Attach our script here <== The last step, so we are sure all listeners are set up by this point
//			prefixSrc("jquery-3.5.1.js", "shared"),  -- already loaded
			_execScripts(_tabId, [prefixSrc("formAndHandlers.js", "previsit"), prefixSrc("previsit.js", "previsit")], "document_end").catch((err) => {
				console.error("Error while injecting Content Scripts for previsiting. Close the tab and move on?", err);
			});
			// 9 - Inject CSS for our form
			browser.tabs.insertCSS(_tabId, {cssOrigin: "author", file: prefixSrc("previsit.css", "css")}).catch(err=>{
				console.error("Error while injecting CSS to previsit a page ==> Close the tab and move on?, err:", JSON.stringify(err));
			}); // we don't care to wait for this promise resolution - it will before we can react
		}
	};
	browser.webNavigation.onCompleted.addListener(handleOnComplete); // Assing here, before opening a tab, so we are sure it's fired
	// 2 - Open a new tab
	return browser.tabs.create({
		url: aUrlObj.actualUrl
	}).then(function (aTab) {
		_tabId = aTab.id;
		return new Promise(function (resolve, reject) {
			// 4 - Handle tab closing - if it closes before we had the data, the URL should be removed, since smth bad happened, like to response -- Including 404 and 500 cases
			const handleTabClose = (closedTabId) => {
				if (closedTabId === aTab.id) {
					// NOTE: We should unassign listeners here - some events may not fire, and we'll be left with handlers still listening
					browser.runtime.onMessage.removeListener(tabIdListener);
					browser.tabs.onRemoved.removeListener(handleTabClose);
					browser.runtime.onMessage.removeListener(allDoneListener);
					browser.webNavigation.onCompleted.removeListener(handleOnComplete);
					if (!_urlDone) { // check if the closure is after all saved
						// remove this url from progress, and save everything downstream ==> just fire a relevant event, so some other code handles it elsewhere
						//						browser.runtime.sendMessage({"action": "banishPage", urlId: aUrlObj.url}); // NO: here we tell this directly to the App, no need to forward it Content Script
						//						handlePageBanish({"action": "banishPage", urlId: aUrlObj.url}, null, function(){
						//							resolve();
						//						});
						//						browser.runtime.sendMessage({"action": "banishPage", urlId: aUrlObj.url}).then(resolve).catch(reject);
					} else {

					}
					resolve(_urlDone); // resolve no matter what - we are done with this page
				} // else ignore - it's not about our tab
			};
			// 5 - Tell the script it's urlId for future communications
			const tabIdListener = (msg, sender, respF) => {
				if (msg.action === "giveMeTabId" && aTab.id === sender.tab.id) {
					respF({
						"action": "haveYourTabId",
						"tabId": aTab.id,
						"urlId": aUrlObj.url
					});
				}
			};
			// 6 - When the work is done, close the tab, resolve Promise
			const allDoneListener = (msg) => {
				if (msg.action === "doNextStep" && msg.urlId === aUrlObj.url) {
					_urlDone = true;
					window.setTimeout(()=>{
						// a small delay so the messageSender Promise in ContentScript is resolved before the tab is destroyed - otherwise irregular exceptions
						browser.tabs.remove(aTab.id).catch(reject);
					}, 100);
				}
			};

			// 9 Assign all handlers
			browser.tabs.onRemoved.addListener(handleTabClose);
			browser.runtime.onMessage.addListener(tabIdListener); // NOTE: let's hope assigning it here isn't too late and a Content Script has already fired the event
			browser.runtime.onMessage.addListener(allDoneListener);
		});
	});
}

function __scanAllSettledForRejects(errorPrefix) {
	return (promResArr) => {
		promResArr.forEach(res => {
			if (res.status === "rejected") {
				console.error("A promise rejected,", errorPrefix, JSON.stringify(res.reason));
			}
		});
	};
}


function _execScripts(tabId, fileArr, runAt = "document_end", frameId = 0) {
	return (Promise.all(fileArr.map(aFile => {
		const opts = {
			file: aFile,
			runAt: runAt,
			frameId: frameId
		};
		return browser.tabs.executeScript(tabId, opts);
	})));
}
