/* global browser */

(()=>{
	const IFRAME_RE_INJECTION_TIMEOUT = 5500; // we don't need much - we are here after iframes were "loaded"
	
	function ensureIFrameRunContentScriptAsync(_tabId, _frameId){
		return browser.tabs
			.sendMessage(_tabId, {"action": "ping"}, {frameId: _frameId})
			.catch(e=>{
				// trying to recover -- xml documents (translated in html) don't have scripts loaded in them automatically
				console.log("%cManually injecting scripts in an iframe", "color:orange;");
				console.warn(e);
				const jsArr = browser.runtime.getManifest()["content_scripts"][0]["js"];
				const cssArrPr = browser.runtime
					.getManifest()["content_scripts"][0]["css"]
					.map(cssF=>{
						// injecting all Css files -- even though we have only 1 now
						return browser.tabs.insertCSS(_tabId, {frameId: _frameId, file: cssF, runAt: "document_end"});
					});
				// Making it sequential
				const jqPr = jsArr.reduce((p, jsF)=>{
					return p.then(()=>{
						return browser.tabs.executeScript(_tabId, {file: jsF, runAt: "document_end", frameId: _frameId});
					});
				}, Promise.resolve());
				const iframePingablePr = new Promise(function(resolve, reject) {
					browser.runtime.onMessage.addListener(function _pingableHandler(msg, sender){
						// console.warn("sender.frameId:", sender.frameId, "msg.action:", msg.action);
						if(sender.frameId === _frameId && msg.action === "pingable"){
							console.log("%cIFRAME PINGABLE NOW", "color:red;");
							browser.runtime.onMessage.removeListener(_pingableHandler);
							resolve();
						}
					});
				});
				return Promise
					.all(cssArrPr)
					.then(jqPr)
					.then(()=>Promise
						.race([iframePingablePr, _prAlarm(IFRAME_RE_INJECTION_TIMEOUT, true)])
						.catch(()=>{
							const e = "[BG] IFRAME NOT Pingable after a timeout: " + _frameId;
							console.error(e);
							throw e;
						})
					)
					.then(()=>{
						// trying again to ping
						return browser.tabs.sendMessage(_tabId, {"action": "ping"}, {frameId: _frameId});
					});
			})
			.then(respMsg=>{
				// if(respMsg._href.indexOf("about:srcdoc") > -1){
				// 	console.warn("[SRCDOC] AFTER Pong.", respMsg);
				// }
				console.assert(respMsg.action === "pong");
			});
	}
	
	function _prAlarm(delay, ifRejectOnAlarm = false){
		return new Promise(function(resolve, reject) {
			setTimeout((ifRejectOnAlarm)?reject:resolve, delay);
		});
	}
	
	window.ensureIFrameRunContentScriptAsync = ensureIFrameRunContentScriptAsync;
	
})();
