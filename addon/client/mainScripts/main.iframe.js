// NOTE: we presume everything has been loaded already


/* eslint-env browser */
/* global jQuery  */
/* global browser */

(function main(){
	// avoid running for the main window
	if(window.top === window){
		console.log("Avoiding running an iframes' script in the main window", window.location.href);
		return;
	}
	console.log("Running main.iframe.js in a frame: ", window.location.href);
	
	var urlId = "NOT SET URL ID";
	var tabId = "NOT SET TAB ID";
	var parentFrameUrlId = "NOTE SET";
	var machineFrameId;
	var settings = "Not set";
	const frameSize = {
		height: "not set",
		width: "not set",
		absTop: "not set",
		absLeft: "not set"
	};

	// tmp fool check Message Listener
	browser.runtime.onMessage.addListener((msg, sender, respF)=>{
		if(msg.urlId !== urlId && ["ProcessIFrameParams", "ScrambleIFrame", "RestoreIFrame"].includes(msg.action)){
			console.error("Background sends messages to a specific tab and a specific frame -- but here msg.ulrId doesn't match previously specified urlId, which means the message is for a different tab/frame. msg.urlId: ", msg.urlId, " urlId:", urlId);
		}
	});
	
	function _askForTopDocSizeAsync(){
		return new Promise(function(resolve, reject) {
			window.addEventListener("message", (e)=>{
				if(e.data.action === "HaveYourDocSize"){
					// console.error("DOC SIZE RECEIVED", window.location.href);
					resolve(e.data.width * e.data.height);
				}
			});
			window.top.postMessage({action: "TellMeDocSize"}, "*");
		});
	}
	
	// TODO: replace with _alarmPr
	function tmpPromiseDelay(delay = 5000){
		return new Promise(function(resolve, reject) {
			window.setTimeout(resolve, delay);
		});
	}
	
	// console.error("SETTING ProcessIFrameParams in", location.href);
	browser.runtime.onMessage.addListener((msg, sender, respF)=>{
		if(msg.action === "ProcessIFrameParams"){
			// window.prepDomForInstaManip(); // We won't restore -- I don't care... <== REMOVED + done inside page.params.js
			// Determine if this iframe is a widget
			return tmpPromiseDelay(0).then(()=>_askForTopDocSizeAsync()).then((topDocSize)=>{
				const MAX_WIDGET_SIZE = 0.8; // if widget is > 80% of top document size, it's no widget - it's a webpage
				const thisIsIframe = true;
				const thisIframeIsAWidget = topDocSize * MAX_WIDGET_SIZE > frameSize.height * frameSize.width;
				return window.getPageVarData(settings.pageVarsNeeded, thisIframeIsAWidget, thisIsIframe);
			}).then(({dataTables, membershipTables, debugScreenshots, groupsOfImgArr}) => {
				if(dataTables === undefined){
					return Promise.resolve(); // we didn't need to collect page variables
				}
				// return new Promise(()=>{});
				const prArr = [];
				prArr.push(browser.runtime.sendMessage({
					"action": "SaveTxtArr",
					"urlId": urlId,
					"dat": dataTables,
					"folders": ["pageData", urlId],
					"type": "txt"
				}));
				prArr.push(browser.runtime.sendMessage({
					"action": "SaveTxtArr",
					"urlId": urlId,
					"dat": membershipTables,
					"folders": ["pageGroupMembership", urlId],
					"type": "txt"
				}));
				prArr.push(browser.runtime.sendMessage({
					"action": "SaveImgArr",
					"urlId": urlId,
					"folders": ["debugScreenshots", urlId],
					"dat": debugScreenshots
				}));
				Object.keys(groupsOfImgArr).forEach(key => {
					prArr.push(browser.runtime.sendMessage({
						"action": "SaveImgArr",
						"urlId": urlId,
						"folders": ["images", key, urlId],
						"dat": groupsOfImgArr[key]
					}));
				});
				// a sort of a hack - saving iframe's size in the parent document
				dataTables.push({
					"name": "iframe.boundingbox.inparent",
					"dat": "iFrameHeight" + "\t" + "iFrameWidth" + "\t" + "posTop" + "\t" + "posLeft" + "\n" + frameSize.height + "\t" + frameSize.width+ "\t" + frameSize.absTop+ "\t" + frameSize.absLeft + "\n"
				});
				return Promise.allSettled(prArr);
			});
		}
	});
	
	browser.runtime.onMessage.addListener((msg)=>{
		if(msg.action === "PrepIFrameDom"){
			return window.prepDomForDataExtractionAsync(false);
			// window.prepDomForDataExtraction(false); // false so visual diff isn't calculated -- to speed up - we do it in the main frame
			// return Promise.resolve();
		}
	});
	
	browser.runtime.onMessage.addListener((msg)=>{
		if(msg.action === "houseKeepIFrameDom"){
			// some safeguard housekeeping before we save HTML/DOM etc.
			window.toggleDomPrepForInstaManip("off");
			window.restoreDomAfterDataExtraction();
			return Promise.resolve();
		}
	});
	
	browser.runtime.onMessage.addListener((msg)=>{
		if(msg.action === "ScrambleIFrame"){
			return window._scramblePage(msg.scrambleMethod, urlId); // resolves when we are done and thus notifies the sender
		}
	});
	
	browser.runtime.onMessage.addListener((msg)=>{
		if(msg.action === "RestoreIFrame"){
			return window._restorePage(msg.scrambleMethod); // resolves when we are done and thus notifies the sender
		}
	});
	
	// arrives after an Iframe is checked to be visible -- I move it to an earlier point, and join together with FrameId-query handling
	browser.runtime.onMessage.addListener((msg, sender, respF)=> {
		if (msg.action === "haveYourTabId_iframe") {
			tabId = msg.tabId;
			urlId = msg.urlId;
			parentFrameUrlId = msg.parentFrameUrlId;
			settings = msg.settings;
			Object.assign(frameSize, msg.frameSize);
			console.log("IFrame's content script is loaded and got tab and url ids, ", urlId);
			respF({"action": "receivedMyTabId_iframe", urlId: urlId});
			// putting frameSize in scrollingElement -- so we can adjust bboxes down to this
			window.getScrlEl()._thisFrameHeight = frameSize.height;
			window.getScrlEl()._thisFrameWidth = frameSize.width;
			
		}
	});
	
	// Remembering this Iframe Machine ID -- so we can later tell it to Papa Window, so it can link <iframes> with Background Iframes
	browser.runtime.sendMessage({action: "TellMeMyMachineIframeId"}).then((msg)=>{
		console.assert(msg.machineFrameId !== undefined);
		machineFrameId = msg.machineFrameId;
	});
	
	window.addEventListener("message", function handleMachineIdRequests (e){
		if(e.data.action === "TellPapaYourMachineId"){
			console.assert(machineFrameId !== undefined, "Iframe machineFrameId requested before the iframe has received it.", window.location.href);
			const scrl = window.getScrlEl();
			const winSize = Math.min(window.innerHeight * window.innerWidth, scrl.scrollWidth * scrl.scrollHeight);
			const dat = {
				// width: window.getScrlEl().scrollWidth,
				machineFrameId: machineFrameId,
				winSize: winSize, // Also sending the iframe window size -- Parent Window needs it at this moment anyway
				msgId: e.data.msgId, // so we don't have to chain promises to know who send what
				action: "HaveYourMachineId"
			};
			e.source.postMessage(dat, "*");
			window.removeEventListener("message", handleMachineIdRequests); // clean-up
		}
	});

})();

undefined;
