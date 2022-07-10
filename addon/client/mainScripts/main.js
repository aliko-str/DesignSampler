/* eslint-env browser */
/* global jQuery  */
/* global browser */

// const _debug = true;

(function(){
	var cnvsDiffAfterShadowDomMods, accuDiffAfterShadowDomMods;
	
	function applyPageModsAsync(){
		// We need to do this before anything else, but after a page loaded -- pageMods determine which iframes are visible (e.g., due to removing "overflow:hidden" on <html>)
		return browser.runtime.sendMessage({"action": "GiveMePageMods"})
			.then((msg)=>{
				console.assert(msg.action === "HaveYourPageMods");
				try {
					var pageModF = eval("(" + msg.pageModF + ")");
					if (!pageModF || typeof pageModF !== "function") {
						throw new Error("Passed pageModF isn't a function: " + msg.pageModF);
					}
				} catch (err) {
					console.error("[PAGE_MODS]", err);
				}
				// Enabling Page-Script events --> because some of our pageMods rely on "click" event handlers
				window.dispatchEvent(new Event("StartEventHandling"));
				try {
					pageModF(jQuery, window.CssInjector._injectStringCss);
					window.__ssGenericPageMod();
				} catch (e) {
					console.error("[PAGE_MODS] Page Modification Failed (but we continue): ", e);
				}
			})
			.then(window._scrollDownAsync)
			.then(window._scrollTopAsync)
			// .then(window.stopMarqueeAsync)
			.then(()=>window._alarmPr(350)) // Giving a bit of time for animations to run/start/apply + Scrolling Up/Down for JS-triggered scroll-dependent animations to run
			.then(()=>{
				// Page Mods and Animation Freezing 
				window.__pageContextGenericMods();
				window.stopAllAnimations(); // Everything is frozen in place after this F - no changed to DOM from page scripts
			})
			.then(()=>window._alarmPr(450)); // So stopped animations/transitions finalize... Hope 450 is enough
	}
	
	function addonMain(){
		console.log("Main Content Script rolling, ", window.location.href);
		window.recordNoStylingCssAsync()
			.then(applyPageModsAsync)
			.then(()=>window.unwrapShadowDomAsync(true)) // NOTE: I have to do it here (and not with other page alterations) since otherwise the new IFrames won't be counted as visible, and won't be processed
			.then(diff=>{
				if(diff){
					cnvsDiffAfterShadowDomMods = diff.diffCnvs;
					accuDiffAfterShadowDomMods = diff.accuDiff;
				}
			})
			.then(()=>{
				return window._alarmPr(1000);
			})
			.then(handleIFrameLoadingAsync)
			.then(mainWork);
	}
	

	
	function handleIFrameLoadingAsync(){
		_listenForDocSizeQuestions();
		var handleIFrameLoaded;
		const allDonePr = new Promise(function(resolve, reject) {
			handleIFrameLoaded = (msg)=>{
				if(msg.action === "IFramesLoaded"){
					browser.runtime.onMessage.removeListener(handleIFrameLoaded); // clean up
					// for some reason "smooth" scrolling sometimes doesn't render/does nothing --> use instant just to be sure all coord matching works
					window.scrollTo({top: 0, left: 0, behavior: "instant"});
					// Recording allPrimitivesCmpStylesNoStyling <== Putting it here because we may need to record allPrimitivesCmpStylesNoStyling and we can't toggle styling without some animations snapping back in "default" state, which is often hidden/invisible
					resolve();
				}
			};
		});
		
		browser.runtime.onMessage.addListener(handleIFrameLoaded);

		browser.runtime.onMessage.addListener((msg, sender)=>{
			// NOTE: this message must be sent to a specific TAB only - we don't check urlId here, since we don't have it yet
			if(msg.action === "GiveMeIFrameVisibility"){ // we only check visibility superficially
				// console.warn("GiveMeIFrameVisibility CALLED", location.href);
				return window.propagateFrVisReqsAsync().then(visFrInfoArr=>{
					// console.warn("GiveMeIFrameVisibility REPLYING WITH DATA", location.href);
					return {"action": "HaveYourIFrameVisibility", "visFrInfoArr": visFrInfoArr || [], "mainFrameUrl": window.location.href};
				});
				
			}
		});
		browser.runtime.sendMessage({"action": "HaveIFramesLoaded?"});
		return allDonePr;
	};

	function mainWork() {
		var urlId = "NOT SET URL ID";
		var tabId = "NOT SET TAB ID";
		var pageModF = "NOT Set";
		var settings = "Not set";
		// if (!jQuery) {
		// 	throw new Error("We'd want jQuery loaded");
		// }
		// changing page title to a unique ID -- needed for this tab detection
		const oldTitle = document.title;
		document.title = Math.round(Math.random() * 10000000);
		console.log("[scrollHeight] Before:", window.getScrlEl().scrollHeight, "window.innerHeight:", window.innerHeight);
		browser.runtime.sendMessage({
			"action": "giveMeTabId",
			"pageScrollHeight": window.getScrlEl().scrollHeight,
			"pageTitleId": document.title
		}).then(function (respObj) {
			console.assert(respObj.action === "haveYourTabId");
			// restoring the real page title
			document.title = oldTitle;
			// saving our internal tab/url ids
			tabId = respObj.tabId;
			urlId = respObj.urlId;
			settings = respObj.settings;
		}).then(()=>{
			// Run it all - Promises used for async
			const p0 = (!settings.screenshotsNeeded) ? Promise.resolve() : (browser.runtime.sendMessage({
				"action": "SaveImg",
				"urlId": urlId,
				"folders": ["screenshots"],
				"name": window._urlToHost(urlId),
				"dat": window.getScreenshotDataUrl(settings.fullLengthScreenshot)
			}));
			p0.then(()=>{
				console.log("DONE SAVING SCREENSHOT");
				if(settings.pageVarsNeeded){
					// first wait for iFrames to do Dom Prepping
					return browser.runtime.sendMessage({
						"action": "PrepIFrames",
						"urlId": urlId
					}).then(()=>{
						// iframes are done, so let's do screenshotting to see if we broke Design by changing DOM
						return window.prepDomForDataExtractionAsync(true)
							.then(({accuDiff, diffCnvs})=>{
								return browser.runtime.sendMessage({
									"action": "SaveImg",
									"urlId": urlId,
									"folders": ["visDiffAfterDomManip"],
									"name": accuDiff + "_" + window._urlToHost(urlId),
									"dat": window.__cnvs2DataUrl(diffCnvs)
								});
							});
					});
				}
				return Promise.resolve(); // we won't be collecting data, so don't bother changing anything
			}).then(() => {
				// Not sure where else to put this...
				if(cnvsDiffAfterShadowDomMods){ // if nothing was changed/replaced, we have no visDiff to save
					return browser.runtime.sendMessage({
						"action": "SaveImg",
						"urlId": urlId,
						"folders": ["visDiffAfterShadowDomManip"],
						"name": accuDiffAfterShadowDomMods + "_" + window._urlToHost(urlId),
						"dat": window.__cnvs2DataUrl(cnvsDiffAfterShadowDomMods)
					});	
				}
			}).then(() => {
				return window.getPageVarData(settings.pageVarsNeeded);
			}).then(({dataTables, membershipTables, debugScreenshots, groupsOfImgArr}) => {
				console.log("Readability to be saved:", urlId);
				if(dataTables === undefined){
					return Promise.resolve(); // we didn't need to collect page variables
				}
				// return new Promise(()=>{});
				const prArr = [];
				prArr.push(browser.runtime.sendMessage({
					"action": "SaveImg",
					"urlId": urlId,
					"folders": ["postModSS"],
					"name": window._urlToHost(urlId),
					"dat": window.getScreenshotDataUrl(true) //we may have altered the page (e.g., moving bottom-window items/menus down the page) -- let's save a new screenshot -- suitable for studies with scrolling
				}));
				prArr.push(browser.runtime.sendMessage({
					"action": "SaveTxtArr",
					"urlId": urlId,
					"dat": dataTables,
					"folders": ["pageData", window._urlToHost(urlId)],
					"type": "txt"
				}));
				prArr.push(browser.runtime.sendMessage({
					"action": "SaveTxtArr",
					"urlId": urlId,
					"dat": membershipTables,
					"folders": ["pageGroupMembership", window._urlToHost(urlId)],
					"type": "txt"
				}));
				// NOTE: I can't use SaveImgArr instead because when a message is too large, everything almost freezes - no idea why; maybe some buffer gets dumped on hd or smth
				prArr.push(...debugScreenshots.map(imgObj=>{
					return browser.runtime.sendMessage(Object.assign(imgObj, {
						"action": "SaveImg",
						"urlId": urlId,
						"folders": ["debugScreenshots", window._urlToHost(urlId)]
					}));
				}));
				// prArr.push(browser.runtime.sendMessage({
				// 	"action": "SaveImgArr",
				// 	"urlId": urlId,
				// 	"folders": ["debugScreenshots", window._urlToHost(urlId)],
				// 	"dat": debugScreenshots
				// }));
				Object.keys(groupsOfImgArr).forEach(key => {
					prArr.push(browser.runtime.sendMessage({
						"action": "SaveImgArr",
						"urlId": urlId,
						"folders": ["images", key, window._urlToHost(urlId)],
						"dat": groupsOfImgArr[key]
					}));
				});
				// call ProcessIFrames to collect all of the inaccessible data
				prArr.push(browser.runtime.sendMessage({
					"action": "ProcessIFrames",
					"urlId": urlId
				}));
				
				// return new Promise(()=>{});
				
				// EXTRA step -- add a 'variant' in settings.screenshotVariants to later obtain white space measurement
				const extraScrambleVariants = [{
					img: window.SCRAMBLE_VARIANTS.IMG.BLACK_OUT,
					cntrl: window.SCRAMBLE_VARIANTS.CNTRL.BLACK_OUT,
					txt: window.SCRAMBLE_VARIANTS.TXT.BLACK_BG
				}];
				settings.screenshotVariants.unshift(...extraScrambleVariants);
				// wait data saving before the next step
				return Promise.allSettled(prArr);
			}).then((_settledRes)=>{
				// console.log(_settledRes.map(x=>x.status+x.reason));
				if(!settings.pageVarsNeeded){
					return Promise.resolve();
				}
				// handle clustering primitives and recording them as a group
				// NOTE: we'll use nested Promises here - for the sake of "visual" modularity in this giant promise chain
				
				// return new Promise(function(resolve, reject) {});
				
				return window.getDistBtwPrimitivesAsync().then(dat=>{
					return browser.runtime.sendMessage({
						"action": "SaveTxtArr",
						"urlId": urlId,
						"dat": dat,
						"folders": ["dataForClustering", window._urlToHost(urlId)]
					});
				}).then(()=>{
					return browser.runtime.sendMessage({
						"action": "RequestRAction",
						"RAction": "RequestClustering", // OPTIMIZE: An actual R cmd here? <-- If we have more than 1 command. Otherwise, no point optimizing.
						"urlId": urlId,
						"dataFolder": ["dataForClustering", window._urlToHost(urlId)]
					});
				}).then(window.primitiveClusters2Data).then(({clustFitDat, dataTables, membershipTables, debugScreenshots}) => {
					const prArr = [];
					prArr.push(browser.runtime.sendMessage({
						"action": "SaveTxtArr",
						"urlId": urlId,
						"dat": dataTables,
						"folders": ["pageData", window._urlToHost(urlId)],
						"type": "txt"
					}));
					prArr.push(browser.runtime.sendMessage({
						"action": "SaveTxtArr",
						"urlId": urlId,
						"dat": clustFitDat,
						"folders": ["_cmpClustFitDat", window._urlToHost(urlId)],
						"type": "txt"
					}));
					prArr.push(browser.runtime.sendMessage({
						"action": "SaveTxtArr",
						"urlId": urlId,
						"dat": membershipTables,
						"folders": ["pageGroupMembership", window._urlToHost(urlId)],
						"type": "txt"
					}));
					prArr.push(...debugScreenshots.map(imgObj=>{
						return browser.runtime.sendMessage(Object.assign(imgObj, {
							"action": "SaveImg",
							"urlId": urlId,
							"folders": ["debugScreenshots", window._urlToHost(urlId)]
						}));
					}));
					// prArr.push(browser.runtime.sendMessage({
					// 	"action": "SaveImgArr",
					// 	"urlId": urlId,
					// 	"folders": ["debugScreenshots", window._urlToHost(urlId)],
					// 	"dat": debugScreenshots
					// }));
					return Promise.allSettled(prArr).then(()=>{
						console.log("DONE cluster data saving");
					});
				}).then(()=>{
					// console.log("DONE 2 cluster saving");
				});
			}).then(()=>{
				return  (!settings.screenshotVariants.length) ? Promise.resolve() : settings.screenshotVariants.reduce((p, variant) => {
					// make it sequential -- we can't do it in parallel
					return p.then(()=>{
						return browser.runtime.sendMessage({
							"action": "ScrambleIFrames",
							"urlId": urlId,
							"scrambleMethod": variant
						}).then(function(){
							// urlId is here for logging only
							return window._scramblePage(variant, urlId).then(()=>{
								// a small delay to apply CSS changes
								return new Promise(function(resolve, reject) {
									window.setTimeout(resolve, 500);
								});
							}); 
						}).then(() => {
							return browser.runtime.sendMessage({
								"action": "SaveImg",
								"urlId": urlId,
								"folders": ["screenShotVariants", variant.img + "_" + variant.txt],
								"name": window._urlToHost(urlId),
								"dat": window.getScreenshotDataUrl(settings.fullLengthScreenshot)
							});
						}).then(()=>{
							// restore iFrames back to normal
							return browser.runtime.sendMessage({
								"action": "RestoreIFrames",
								"urlId": urlId,
								"scrambleMethod": variant
							});
						}).then(()=>{
							window._restorePage(variant);
							// a small delay to apply CSS changes
							return new Promise(function(resolve, reject) {
								window.setTimeout(resolve, 500);
							});
						});
					});
				}, Promise.resolve());
			}).then(() => {
				// do housekeeping in iframes -- before the main Frame housekeeping (we switch from iframes back to Shadow DOM, which removes some iframes)
				return browser.runtime.sendMessage({
					"action": "HouseKeepIFrames",
					"urlId": urlId
				});
			}).then(()=>{
				// some safeguard housekeeping before we save HTML/DOM etc.
				window.dispatchEvent(new Event("StartEventHandling"));
				window.toggleDomPrepForInstaManip("off");
				window.restoreDomAfterDataExtraction();
			}).then(()=>{
				// all Done
				return browser.runtime.sendMessage({
					"action": "MarkPageDone",
					"urlId": urlId
				});
			});
		});
	};
	
	function _listenForDocSizeQuestions(){
		// iFrame windows will ask for the top-window document size - to determine if they are widgets or full-blown webpages themselves
		window.addEventListener("message", (e)=>{
			if(e.data.action === "TellMeDocSize"){
				// console.log("DOC SIZE requested");
				const dat = {
					// width: window.getScrlEl().scrollWidth,
					width: window.__getSaneDocScrollWidth(),
					height: window.getScrlEl().scrollHeight,
					action: "HaveYourDocSize"
				};
				e.source.postMessage(dat, "*");
			}
		});
	}

	window.addonMain = addonMain;
	
})();


undefined;
