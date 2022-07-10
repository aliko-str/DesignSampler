/* eslint-env browser */

// Sometimes I need to keep references to some data - e.g., computed styles (that change during replacement)

(()=>{
	function _generateId() {
		const id = Math.random().toString(36).substr(2);
		if (window.__idStore === undefined) {
			window.__idStore = {};
		}
		if (window.__idStore[id] !== undefined) {
			return _generateId(); // a non-unique id ==> try generating again
		}
		window.__idStore[id] = 1;
		return "i" + id; // prefixing with a letter, for R
	}

	function assingHiddenIdsAllEls() {
		Array.from(document.querySelectorAll("*")).forEach(el => {
			if(!el._id){
				el._id = _generateId();
				el.dataset.elGenId = el._id;
			}
		});
	}
	
	function _getElId(el) {
		if (el._id === undefined) {
			console.warn("Found an element without an assigned _id, el:", window.__el2stringForDiagnostics(el));
			el._id = window._generateId();
			el.dataset.elGenId = el._id;
		}
		return el._id;
	}
	
	const {getPreComputedStyles, hasPreComputedStyles} = (()=>{
		// returns getComputedStyle calculated once per element at some point, e.g., after we froze animations <-- Needed during replacement during Scramble
		const cmpStStore = {};
		const pseudo2record = [":before", ":after"];
		const _makeIdF = (el, pseudoKey = null)=>{
			return window._getElId(el)+(pseudoKey?pseudoKey.replace("::", ":"):"");
		};
		const _recordStyles = (timepoint)=>{
			console.assert(cmpStStore[timepoint] === undefined, "Already initialized styleStore for the timepoint:", timepoint, "?... Debug.", location.href);
			// initializing cmpStStore
			const stIdPairs = pseudo2record
				.concat([null]) // so we also record real element styles
				.map(pseudoType=>{
					return Array.from(document.querySelectorAll("*")).map(el=>{
						const st = window.getComputedStyle(el, pseudoType);
						if(pseudoType && st["content"] === "none"){
							return [];
						}
						return [_makeIdF(el, pseudoType), window.__cssValsToObj(st, window.__getAllCssPropList())];
					});
				}).flat(1);
			cmpStStore[timepoint] = Object.fromEntries(stIdPairs);
		};
		document.documentElement.addEventListener("UIFrozen", (e)=>{
			assingHiddenIdsAllEls(); // a convenient place for assigning ids
			_recordStyles("UIFrozen");
		}, false);
		document.documentElement.addEventListener("NoShadowDOM", (e)=>{
			assingHiddenIdsAllEls();
			_recordStyles("NoShadowDOM");
		}, false);
		document.documentElement.addEventListener("DOMPrepped", (e)=>{
			assingHiddenIdsAllEls(); // new elements have been added, so we should assign them ids
			_recordStyles("DOMPrepped");
		}, false);
		return {
			getPreComputedStyles(el, timepoint = "DOMPrepped", pseudoType = null){
			// if cmpStStore isn't initialized, let it fall.
				if(!cmpStStore[timepoint]){
					throw "Initialize cmpStStore. Timepoint: " + timepoint;
				}
				const elId = _makeIdF(el, pseudoType);
				if(!cmpStStore[timepoint][elId]){
					console.error("cmpStStore for ", elId, "not initialized for timepoint", timepoint, " ==> computing styles now, but debug.", window.__el2stringForDiagnostics(el));
					const st = window.getComputedStyle(el, pseudoType);
					cmpStStore[timepoint][elId] = window.__cssValsToObj(st, window.__getAllCssPropList());
				}
				return cmpStStore[timepoint][elId];
			},
			hasPreComputedStyles(el, timepoint = "DOMPrepped", pseudoType = null){
				return cmpStStore[timepoint] && _makeIdF(el, pseudoType) in cmpStStore[timepoint];
			}
		};
	})();
	
	// TODO: use this F in dom preparation instead of an internal solution in __wrapTextNodesInSpans/_detachPseudoElements
	function revert2PreCompStyles(elArr, timepoint = "DOMPrepped", settings = {bruteForce: false}){
		const cssInjctr = new window.CssInjector(); // I'll use a CSS injector - because by this point I don't remember what CSS I save/overwrite on top of what
		const doNotTrackProps = ["transition", "animation-play-state", "block-size"];
		elArr
			.filter(el=>hasPreComputedStyles(el, timepoint))
			.forEach(el => {
				const oldSt = getPreComputedStyles(el, timepoint);
				const newSt = window.getComputedStyle(el);
				// const changedStyles = window.__getAllCssPropList({excludePrefixed: false}).filter(st => newSt[st] !== oldSt[st]).filter(x=>!doNotTrackProps.includes(x));
				const stObj2Enforce = window.stripIdenticalCss(oldSt, newSt);
				if(settings.bruteForce){
					// animation frames can only be overwitten with !important added
					Object.assign(stObj2Enforce, window.__cssObj2Imp(stObj2Enforce));
				}
				doNotTrackProps.forEach(p => delete stObj2Enforce[p]);
				if (Object.keys(stObj2Enforce).length) {
					// const stObj2Enforce = Object.fromEntries(changedStyles.map(st => [st, oldSt[st]]));
					cssInjctr._injectCss1Element(el, "", stObj2Enforce); // This should have enough specificity to overwrite the effects of changed siblings
					console.log("[STYLE] Reverting style to pre-computed values. Timepoint:", timepoint, window.__el2stringForDiagnostics(el), stObj2Enforce);
				}
			});
		return function cleanUpF(){
			cssInjctr._removeAllCss();
		};
	}
	
	window._getElId = _getElId;
	window._generateId = _generateId;
	window.revert2PreCompStyles = revert2PreCompStyles;
	window.getPreComputedStyles = getPreComputedStyles;
})();
