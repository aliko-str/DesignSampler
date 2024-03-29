/* eslint-env browser */
// NOTE: ONLY Runs in the main frame

(()=>{
	// making sure timeouts/intervals aren't called with 0 delay -- freezes the main process
	// console.warn("[EARLY] Page mods running.");
	// const urls2skipJsOverwriting = ["youtube", "youtu.be"]; //, "www.google.com"
	// // const urls2skipJsOverwriting = [];
	// if(urls2skipJsOverwriting.some(x=>location.host.indexOf(x) > -1)){
	// 	console.log("[EARLY OVERRIDEs]%c NOT Overwriting JS for this host: %s", "color:orange;background-color:darkgreen;", location.host);
	// 	return;
	// }
	const w = window.wrappedJSObject;
	try{
		// Animation frame
		w.eval(`
			(()=>{
				const rAF = window.requestAnimationFrame.bind(window);
				var __requestAnimations = true;
				var __animationCounter = 0;
				window.addEventListener("StopEventHandling", ()=>{
					__requestAnimations = false;
				}, {once: false, passive: true});
				window.addEventListener("StartEventHandling", ()=>{
					__requestAnimations = true;
				}, {once: false, passive: true});
				window.requestAnimationFrame = function(f){
					__animationCounter++;
					if(!(__animationCounter % 1000)){
						console.log("[EARLY OVERRIDEs] Animation Frame request, ", __animationCounter);
					}
					if(__requestAnimations){
						return rAF(f);
					}
					if(!(__animationCounter % 100)){
						console.log("[EARLY OVERRIDEs]%c Not Handling Animation Frame requests, ", "background-color:gray;color:pink;", __animationCounter);
					}
					return 0;
				};
			})();
			`);
		
		// Mutation Observer -- otherwise it generates cyclical events <-- the more we manipulate DOM, the more Observer's callbacks are called -- kills FF
		w.eval(`
			(()=>{
				const observersStore = [];
				var __mutationCounter = 0;
				var __observeMutations = true;
				const MO = window.MutationObserver;
				// Turn it off/on
				window.addEventListener("StopEventHandling", ()=>{
					__observeMutations = false;
					observersStore.forEach(x => {
						x.takeRecords();
						x.disconnect();
					});
					console.log("[EARLY OVERRIDEs] Disconnected observersStore, ", observersStore.length, "__observeMutations:", __observeMutations);
				}, {once: false, passive: true});
				window.addEventListener("StartEventHandling", ()=>{
					__observeMutations = true;
					observersStore.forEach(x => x.observe());
					console.log("[EARLY OVERRIDEs] RECONNECTED observersStore, ", observersStore.length, "__observeMutations:", __observeMutations);
				}, {once: false, passive: true});
				// New MO
				window.MutationObserver = class extends MO{
					constructor(cb){
						var self;
						const realCb = function(mutationList, observer){
							__mutationCounter++;
							// console.log("%c realCb called, ", "color:gray;", __mutationCounter, __observeMutations);
							if(__observeMutations){
								if(cb.name.startsWith("bound") && !cb.hasOwnProperty("prototype")){
									cb(mutationList, observer);
								}else{
									cb.call(self, mutationList, observer);
								}
							}else{
								if(!(__mutationCounter % 100)){
									console.log("[EARLY OVERRIDEs] Not processing MutationObserver changes, n:", __mutationCounter, location.href);
								}
							}
						}
						super(realCb);
						self = this;
						observersStore.push(this);
					}
					observe(targetNode, config){
						this.__lastTargetNode = targetNode || this.__lastTargetNode;
						this.__lastConfig = config || this.__lastConfig;
						if(!this.__lastTargetNode){
							console.log("[EARLY OVERRIDEs]%c our 1st attempt to restore 'observe' - skipping it", "color:red;");
							return;
						}
						if(__observeMutations){
							return super.observe(this.__lastTargetNode, this.__lastConfig);
						}else{
							console.log("[EARLY OVERRIDEs] MutationObserver: observer called while __observeMutations is false.", location.href);
							console.trace();
						}
					}
				}
			})();
			`);
		
		w.eval(`
			(()=>{
				const MAX_TIMEOUTS = 1000;
				var ___counterT = 0;
				var _allowTimeoutsFlag = true;
				window.addEventListener("StopEventHandling", ()=>{
					_allowTimeoutsFlag = false;
					// console.log("StopEventHandling handled", location.href);
				}, {once: false, passive: true});
				window.addEventListener("StartEventHandling", ()=>{
					_allowTimeoutsFlag = true;
					// console.log("StartEventHandling handled", location.href);
				}, {once: false, passive: true});
				window.___origSetTimeoutF = window.setTimeout;
				window.___origSetIntervalF = window.setInterval;
				window.setTimeout = function(f, t, ...args){
					___counterT++;
					if(___counterT === MAX_TIMEOUTS){
						window.__pageScriptEventsAllowed = false;
						console.log("[EARLY OVERRIDEs]%c NO LONGER Setting timeouts, %s ", "background-color:#8b0000; color: gray;", location.href);
					}
					if(!_allowTimeoutsFlag || ___counterT > MAX_TIMEOUTS){
						return 1;
					}
					if(isNaN(t)){
						t = 0;
					}
					t += 10;
					return window.___origSetTimeoutF(f, t, ...args);
				};
				window.setInterval = function(f, t, ...args){
					___counterT++;
					if(___counterT === MAX_TIMEOUTS){
						window.__pageScriptEventsAllowed = false;
						console.log("[EARLY OVERRIDEs]%c NO LONGER Setting intervals, %s ", "background-color:#8b0000; color: gray;", location.href);
					}
					if(!_allowTimeoutsFlag || ___counterT > MAX_TIMEOUTS){
						return 1;
					}
					if(isNaN(t)){
						t = 0;
					}
					t += 10;
					return window.___origSetIntervalF(f, t, ...args);
				}				
			})();
		`);
		// stop event dispatching to all listeners
		w.eval(`
			(()=>{
				var ___counterE = 0;
				// A flag to check for disabling page's event handlers
				// console.log("DISABLING EVENTS", location.href);
				window.__pageScriptEventsAllowed = true;
				window.addEventListener("StopEventHandling", ()=>{
					window.__pageScriptEventsAllowed = false;
					// console.log("StopEventHandling handled", location.href);
				}, {once: false, passive: true});
				window.addEventListener("StartEventHandling", ()=>{
					window.__pageScriptEventsAllowed = true;
					// console.log("StartEventHandling handled", location.href);
				}, {once: false, passive: true});
				// Storage for real/replaced event handlers <-- so the page can 'removeEventListener' correctly
				const __fStore = new Map();
				// Redefining add/removeEventListener
				const __realAddEventListener = EventTarget.prototype.addEventListener;
				const __realRemoveEventListener = EventTarget.prototype.removeEventListener;
				EventTarget.prototype.addEventListener = function(t, f, opt){
					if(f === null){
						return; // do nothing
					}
					if(f.handleEvent){ // a handler can be an object
						var self = f;
						f = f.handleEvent;
					}
					if(__fStore.has(f)){
						return; // simulating addEventListener not adding the same f
					}
					function wF(e){
						___counterE++;
						if(window.__pageScriptEventsAllowed){
							if(___counterE > 1000){ // so we don't pollute too much
								console.log("[EARLY OVERRIDEs] Handling event: %c" + t, "color: #A9C998;");
							}
							// checking if 'this' has been bound, so we don't have to do it
							if(f.name.startsWith("bound") && !f.hasOwnProperty("prototype")){
								f(e);
							}else{
								f.call(self || this, e);
							}
						}else{
							if(___counterE > 1000){ // so we don't pollute too much
								console.log("[EARLY OVERRIDEs] NOT handling page event: %c" + t, "color: #A9C998;");
							}
							// console.log("[EARLY OVERRIDEs] NOT handling page event: %c" + t, "color: red;");
							// if(e && e.stopImmediatePropagation){
							// 	e.stopImmediatePropagation();
							// }
						}
					}
					__fStore.set(f, wF);
					__realAddEventListener.call(this, t, wF, opt);
				}
				EventTarget.prototype.removeEventListener = function(t, f, opt){
					__realRemoveEventListener.call(this, t, __fStore.get(f), opt);
				}
			})();
		`);
	}catch(e){
		console.error(e);
	}
})();
