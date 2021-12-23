/*eslint-env browser */

(()=>{
	const _getAllSelectors = (()=>{
		var allSelectorsArrStore;
		const parenthesisGrFinder = /(\([^())]*\)|\[[^\]\[]*\])/g; // only works for non-nested parentheses; If we meet nested parentheses, we presume it's a rare exception and move on
		return function _getAllSelectors(settings = {refresh: false}){
			if(!allSelectorsArrStore || settings.refresh){
				allSelectorsArrStore = Array.from(document.styleSheets)
					.filter(sheet => {
						try {
							sheet.cssRules;
						} catch (e) {
							console.error("Can't get a stylesheet's rules", sheet.href, window.location.href, " INVESTIGATE. Skipping this stylesheet for now.");
							return false;
						}
						return !sheet.disabled;
					})
					.map(sheet => {
						return Array
							.from(sheet.cssRules)
							.map(rule=>{
								if(rule.media && rule.media.mediaText){
									// extract cssRules from mediaQueries that apply
									if(window.matchMedia(rule.media.mediaText).matches){
										// console.log("Matched media query:", rule.media.mediaText, location.href);
										return Array.from(rule.cssRules);
									}
									return [];
								}
								if(rule.conditionText){
									// This is a @supports rule set
									return CSS.supports(rule.conditionText)?Array.from(rule.cssRules):[];
								}
								return rule;
							});
					})
					.flat(2)
					.filter(rule=>rule.selectorText)
					.map(rule => rule.selectorText)
					.map(s=>{
						// splitting multi-item selectors in individual selectors
						// a - find all contents inside parentheses
						var parnthGr = s.match(parenthesisGrFinder);
						if(parnthGr){
							// b - filter out no-comma parentheses groups - they are no danger for comma-based splitting
							parnthGr = parnthGr.filter(str=>str.indexOf(",") > -1);
							if(parnthGr.length){
								// c - remove parentheses groups from selector
								parnthGr.forEach((gr, i) => {
									s = s.replaceAll(gr, "~~"+i+"~~");
								});
							}
						}
						var splits = s.split(",");
						// d - put parentheses groups back in
						if(parnthGr && parnthGr.length){
							splits = splits.map(subSelector=>{
								parnthGr.forEach((gr, i) => {
									subSelector = subSelector.replaceAll("~~"+i+"~~", gr);
								});
								return subSelector;
							});
						}
						return splits.map(s=>s.trim());
					}).flat();	
			}
			return allSelectorsArrStore;
		};
		
	})();
	
	const __cleanCommasCssSelectors = (()=>{
		// to be used in __findElsStyledOnHover: finds cases of multiple-item pseudo-classes (they now exist), with one of the items being a :hover that we've replaced --> which results in an extra comma, and a failing selector
		const rgx2clean = [[/(\([\s]?,)/gi, "("], [/(,[\s]?,)/gi, ", "], [/(,[\s]?\))/gi, ")"]];
		const ___tstRgx = /(\([\s]?,)|(,[\s]?,)|(,[\s]?\))/gi;
		return (selector)=>{
			const res = rgx2clean.reduce((accu, v)=>selector.replaceAll(v[0], v[1]), selector);
			if(___tstRgx.test(selector)){ // disable after debug
				console.warn("[SELECTOR] Found a selector with a multi-item pseudo-class:", selector, "AFTER FIXING:", res);
			}
			return res;
		};
	})();
	
	function findElsStyledByOrder(){
		// finds elements with styles applied based on ordering, e.g., with nth-child, nth-of-type, +, ~
		const treePseudoClasses = [":root", ":empty", ":nth-child", ":nth-last-child", ":first-child", ":last-child", ":only-child", ":nth-of-type", ":nth-last-of-type", ":first-of-type", ":last-of-type", ":only-of-type", "\\+", "~"].map(x=>new RegExp("([^\\\\])"+x, "g"));
		const selectors2check = _getAllSelectors().filter(s=>treePseudoClasses.some(reg=>s.search(reg) > -1));
		if(selectors2check.length){
			console.log("[CSS] Tree-based selectors found:", selectors2check);
			return Array
				.from(document.documentElement.querySelectorAll("*"))
				.filter(el=>selectors2check
					.some(sel=>el.matches(sel)));
		}
		return [];
	}
	
	function findElsStyledOnHover(jqEls) {
		// finds elements that react to ":hover"
		const regExNestedHover = /[>~+\d\w]( )+:hover/;
		// const cssSelDelim = /,( *[^\d ])/g; // We can't use "," because selectors can contain pseudo functions and styles as strings, i.e., references to rgb colors with commas -- it does happen...
		const selectorsWithHoverArr = _getAllSelectors()
			.filter(selector => {
				return selector && selector.indexOf(":hover") > -1;
			}).map(selector => {
				// sometimes there are "naked" :hover nested selector elements
				const replStr = regExNestedHover.test(selector) ? "*" : "";
				return selector.replaceAll(/([^\\]):hover/g, "$1"+replStr); // for the rare case of idiotic CSS selectors with an escaped ":" befere a "hover" in them --  yes, it happens.
				// return selector.replaceAll(":hover", replStr);
			}).filter(x => x.length).filter(sel => {
				// checking if :hover was nested in another pseudo-class and filtering such cases out
				return sel.indexOf("()") === -1;
			}).map(__cleanCommasCssSelectors); // rare cases of extra commas in multi-item pseudo-classes
		return jqEls.filter((i, el) => {
			// if selectorsWithHoverArr is empty, it's always false --> works for us
			return selectorsWithHoverArr.some(selector => {
				try {
					return el.matches(selector);
				} catch (e) {
					console.error("FAULTY selector:", selector, e, window.location.href);
					debugger;
					return false;
				}
			});
		});
	}
	
	// function findElsStyledOnHover(jqEls) {
	// 	const regExNestedHover = /[>~+\d\w]( )+:hover/;
	// 	const parenthesisGrFinder = /(\([^())]*\)|\[[^\]\[]*\])/g; // only works for non-nested parentheses; If we meet nested parentheses, we presume it's a rare exception and move on
	// 	// const cssSelDelim = /,( *[^\d ])/g; // We can't use "," because selectors can contain pseudo functions and styles as strings, i.e., references to rgb colors with commas -- it does happen...
	// 	const selectorsWithHoverArrArr = Array.from(document.styleSheets).map(sheet => {
	// 		try {
	// 			var cssRules = Array.from(sheet.cssRules);
	// 		} catch (e) {
	// 			console.error("Can't get a stylesheet's rules", sheet.href, window.location.href, " INVESTIGATE. Skipping this stylesheet for now.");
	// 			cssRules = undefined;
	// 			// throw e;
	// 		}
	// 		// const cssRules = Array.from(sheet.cssRules);
	// 		return !cssRules?[]:cssRules.map(rule => rule.selectorText).filter(selector => {
	// 			return selector && selector.indexOf(":hover") > -1;
	// 		}).map(s=>{
	// 			// return s.split(",").map(subS=>subS.trim());
	// 			// splitting multi-item selectors in individual selectors
	// 			// a - find all contents inside parentheses
	// 			var parnthGr = s.match(parenthesisGrFinder);
	// 			if(parnthGr){
	// 				// b - filter out no-comma parentheses groups - they are no danger for comma-based splitting
	// 				parnthGr = parnthGr.filter(str=>str.indexOf(",") > -1);
	// 				if(parnthGr.length){
	// 					// c - remove parentheses groups from selector
	// 					parnthGr.forEach((gr, i) => {
	// 						s = s.replaceAll(gr, "~~"+i+"~~");
	// 					});
	// 				}
	// 			}
	// 			var splits = s.split(",");
	// 			// d - put parentheses groups back in
	// 			if(parnthGr && parnthGr.length){
	// 				splits = splits.map(subSelector=>{
	// 					parnthGr.forEach((gr, i) => {
	// 						subSelector = subSelector.replaceAll("~~"+i+"~~", gr);
	// 					});
	// 					return subSelector;
	// 				});
	// 			}
	// 			return splits.map(s=>s.trim());
	// 			// NOTE: old way below
	// 			// const allSplits = s.split(cssSelDelim);
	// 			// const sels = [allSplits[0]]; // the 1st item is always a valid selector
	// 			// for(var i = 1, ilen = allSplits.length; i < ilen; i+=2){
	// 			// 	sels.push(allSplits[i]+allSplits[i+1]);
	// 			// }
	// 			// return sels.map(s=>s.trim());
	// 		}).flat().map(selector => {
	// 			// sometimes there are "naked" :hover nested selector elements
	// 			const replStr = regExNestedHover.test(selector) ? "*" : "";
	// 			return selector.replaceAll(/([^\\]):hover/g, "$1"+replStr); // for the rare case of idiotic CSS selectors with an escaped ":" befere a "hover" in them --  yes, it happens.
	// 			// return selector.replaceAll(":hover", replStr);
	// 		}).filter(x => x.length).filter(sel => {
	// 			// checking if :hover was nested in another pseudo-class and filtering such cases out
	// 			return sel.indexOf("()") === -1;
	// 		}).map(__cleanCommasCssSelectors); // rare cases of extra commas in multi-item pseudo-classes
	// 	});
	// 	const selectorsWithHoverArr = [...(new Set(selectorsWithHoverArrArr.reduce((a, x) => a.concat(x))))];
	// 	return jqEls.filter((i, el) => {
	// 		// if selectorsWithHoverArr is empty, it's always false --> works for us
	// 		return selectorsWithHoverArr.some(selector => {
	// 			try {
	// 				return el.matches(selector);
	// 			} catch (e) {
	// 				console.error("FAULTY selector:", selector, e, window.location.href);
	// 				debugger;
	// 				return false;
	// 			}
	// 		});
	// 	});
	// }
	
	function toggleCssStyling(onOff = "on") {
		console.assert(onOff === "on" || onOff === "off", "Impossible value of onOff: ", onOff);
		if (onOff === "off") {
			// 1a - disable stylesheets
			Array.from(document.styleSheets).forEach(x => x.disabled = true);
			// 2a - unset 'style' property of each element
			document.querySelectorAll("*").forEach(el => {
				if (el.style.cssText) {
					el._oldStyleCssText = el.style.cssText;
					el.style = null;
				}
			});
		} else {
			// 1b - enable stylesheets
			Array.from(document.styleSheets).forEach(x => x.disabled = false);
			//  2b - restore 'style' properties
			document.querySelectorAll("*").forEach(el => {
				// if(el.tagName.toLowerCase() === "img" && el.classList.contains("fancy-border-radius")){
				// 	debugger;
				// }
				if (el._oldStyleCssText) {
					el.style.cssText = el._oldStyleCssText;
					delete el._oldStyleCssText;
				}
			});
		}
	}
	
	function stripIdenticalCss(cssObj1, cssObj2){
		// cssObj1's values are kept
		var keys;
		try {
			keys = [...cssObj1];
		} catch (e) {
			// an object, not a liveStyleCollection
			keys = Object.keys(cssObj1);
		}
		return Object.fromEntries(keys
			.filter(k=>cssObj2[k] !== cssObj1[k])
			.map(k=>[k, cssObj1[k]])
		);
	}
	
	const {__getAllCssPropList, removeDefaultSpanCss} = (()=>{
		var ref, refNoPrefixed, defCssObj;
		toggleCssStyling("off");
		const sp = document.createElement("span");
		document.documentElement.appendChild(sp);
		const st = window.getComputedStyle(sp);
		defCssObj = Object.fromEntries([...st].map(k=>[k, st[k]]));
		const stNames = [...st];
		sp.remove();
		toggleCssStyling("on");
		ref = stNames;
		refNoPrefixed = ref.filter(_p=>{
			const p = _p.toLowerCase();
			return p.indexOf("moz") === -1 && p.indexOf("webkit") === -1;
		});
		return {
			removeDefaultSpanCss(cssObj){
				return stripIdenticalCss(cssObj, defCssObj);
				// return Object.fromEntries([...cssObj]
				// 	.filter(k=>defCssObj[k] !== cssObj[k])
				// 	.map(k=>[k, cssObj[k]])
				// );
			},
			__getAllCssPropList(settings = {excludePrefixed: false}){
				if(!settings.excludePrefixed){
					return ref;
				}
				return refNoPrefixed;
			}};
	})();
	
	window.findElsStyledByOrder = findElsStyledByOrder;
	window.findElsStyledOnHover = findElsStyledOnHover;
	
	window.__getAllCssPropList = __getAllCssPropList;
	window.removeDefaultSpanCss = removeDefaultSpanCss;
	window.toggleCssStyling = toggleCssStyling;
	window.stripIdenticalCss = stripIdenticalCss;
})();
