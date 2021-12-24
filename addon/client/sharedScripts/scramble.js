/*global browser */
/*eslint-env browser*/

//		{img: "placeholder", text: "normal"},
//		{img: "avg", text: "randomScramble"},
//		{img: "blur", text: "randomScramble"},
//		{img: "normal", text: "nonEnglishRandom"}

(() => {
	const _restoreFStore = {};
	const DEFAULT_BG_COL = "rgba(0, 0, 0, 0)"; // I should probably extract constants somewhere
	const BLUR_RADIUS = 30; // px // TODO: Utilize
	const BLACK_CHAR = String.fromCharCode(9608);
	const DEFAULT_TXT_LINE_EXPANSION = 0.25; // of font size
	const MIN_VISIBLE_OPACITY = 0.05; // [0,1] values for CSS
	const SCRAMBLE_VARIANTS = { // OPTIMIZE: Extract it somewhere where settings.js/main.js can access it
		CNTRL: {
			BLACK_OUT: "blackOut"
		},
		IMG: {
			PLCHOLDER: "placeholder",
			AVG: "avg",
			BLUR: "blur",
			NORMAL: "normal",
			EMPTY_SPACE: "emptySpace",
			BLACK_OUT: "blackOut",
			AVG_WITH_ICONS: "avgWithIcons"
		},
		TXT: {
			NORMAL: "normal",
			RANDOM_REPLACE: "randomScramble",
			RANDOM_CHARS: "randomChars", // NOTE: DOESN"T work -- changes the length of strings, which shifts layout --> use replacement
			NON_ENGLICH: "nonEnglishRandom", // Also won't work
			BLACK_CHAR: "blackChar",
			BLACK_BG: "blackCharBg",
			BLACK_BG_NO_BTWLINES: "blackCharBgAndBtwLines"
		}
	};
	const BLACK_TXT_STYLES = {"-webkit-text-fill-color": "black", "-webkit-text-fill-color": "black", "background-color": "black", "background-image": "none", "color": "black", "text-shadow": "none", "border-color": "black"};

	const isItDigit = (() => {
		const charCodeZero = "0".charCodeAt(0);
		const charCodeNine = "9".charCodeAt(0);
		return (n) => {
			return (n >= charCodeZero && n <= charCodeNine);
		};
	})();

	function isItCapital(c) {
		return c !== c.toLowerCase();
	}

	function isItLetter(c) {
		return c.toLowerCase() !== c.toUpperCase();
	}

	function getRestoreFName(variant) {
		return Object.keys(variant).sort().map(k => k + "_" + variant[k]).join("_");
	}

	const _latinUpper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const _latinLower = "abcdefghijklmnopqrstuvwxyz";
	const _latinNum = _latinLower.length;

	function txt2randomChars(str) {
		str = str || "";
		return [...str].map(aChar => {
			// TODO remove isItDigit <-- isItLetter already covers it			
			//			if(isItDigit(aChar)){
			//				return aChar;
			//			}
			if (!isItLetter(aChar)) {
				return aChar;
			}
			const i = Math.floor(Math.random() * _latinNum);
			if (isItCapital(aChar)) {
				return _latinUpper[i];
			}
			return _latinLower[i];
		}).join("");
	}

	function txt2randomScramble(str) {
		// const letters = [...str.replace(/[\W\d]/g, "").toLowerCase()]; // NOTE: \W filters out non-Latin alpahbet chars - which we'd like to keep --> switching to manual filter
		const letters = [...str].filter(isItLetter).map(char=>char.toLowerCase());
		return [...str].map((aChar) => {
			// TODO remove isItDigit <-- isItLetter already covers it			
			//			if(isItDigit(aChar)){
			//				return aChar;
			//			}
			if (!isItLetter(aChar)) {
				return aChar;
			}
			const repChar = letters.splice(Math.floor(Math.random() * letters.length), 1)[0];
			if (isItCapital(aChar)) {
				// if(!repChar){
				// 	debugger;
				// }
				return repChar.toUpperCase();
			}
			return repChar;
		}).join("");
	}

	function txt2nonEnglishRandom(str) {
		throw new Error("Not implemented yet - I'm not sure it's needed, and which non-English language we'd use and how we'd generate suitable-length words");
	}
	
	function txt2blackChar(str){
		return BLACK_CHAR.repeat(str.length);
	}
	
	const __makeCleanSpan = window.__makeCleanSpan;
	
	function __makeBlackSpan(str){
		// replace text nodes with <span>; set spans to have no padding/margin and transp color
		const span = __makeCleanSpan();
		span.textContent = str;
		__enforceCSSVals(span, BLACK_TXT_STYLES);		
		// span.style.setProperty("background-color", "black", "important"); // make it black
		// span.style.setProperty("color", "black", "important");
		// span.style.setProperty("text-shadow", "none", "important");
		return span;
	}
	
	function __makeBlackSpansPerLetter(el){
		console.assert(el.parentElement !== null, "The parent element for a piece of text is null - can't be");
		const str = el.nodeValue;
		const makeTxtLargerBy = Math.ceil(parseInt(window.getComputedStyle(el.parentElement).fontSize) * DEFAULT_TXT_LINE_EXPANSION);
		const containerSpan = __makeBlackSpan("");
		const subSpans = Array.from(str).map(aChar=>{
			// 1 - Create a span for each character - so the offset-ed span knows where top/left is for each letter
			const oneCharSpan = __makeBlackSpan(aChar);
			oneCharSpan.style.setProperty("position", "relative", "important");
			// 2 - Create up/down spans
			const upSpan = __makeBlackSpan(aChar);
			upSpan.style.setProperty("position", "absolute", "important");
			upSpan.style.setProperty("top", "-" + makeTxtLargerBy + "px", "important");
			upSpan.style.setProperty("left", "0", "important");
			// 2.1 - Down span
			const downSpan = __makeBlackSpan(aChar);
			downSpan.style.setProperty("position", "absolute", "important");
			downSpan.style.setProperty("top", makeTxtLargerBy + "px", "important");
			downSpan.style.setProperty("left", "0", "important");
			// 3 - Assemble a subSpan
			oneCharSpan.appendChild(upSpan);
			oneCharSpan.appendChild(downSpan);
			return oneCharSpan;
		});
		// 4 - Assemble the containerSpan contents
		return subSpans.reduce((accuSpan, aSpan)=>{
			accuSpan.appendChild(aSpan);
			return accuSpan;
		}, containerSpan);
	}

	function scrambleTextAsync(variant) { // F should return a function to roll back changes
		var f = ()=>{
			console.error("You shouldn't see this message --> the defaul txt scrambling f has been called");
		};
		var dataReqProm = Promise.resolve(); // we only need async data for blackBg
		const txtNodeStore = []; // we'll keep references to all changed text nodes
		const cssToRestore = []; // only blackBg uses it
		var _setTxtNodeVal = function(el, modF, {ifControl} = {ifControl: false}){
			if(ifControl){
				el._thisIsAControl = true;
				if(el.value.length === 0 && el.placeholder.length){
					// replacing placeholder
					el._replPlaceholder = true;
					el._oldText = el.placeholder;
					el.placeholder = modF(el.placeholder);
				}else{
					el._oldText = el.value;
					el.value = modF(el.value);	
				}
			}else{
				el._oldText = el.nodeValue;
				el.nodeValue = modF(el.nodeValue);
			}
			txtNodeStore.push(el);
			return el;
		};
		const _restoreTxtNodeVal = function(el){
			if (el._oldText === undefined) {
				console.error("We can't restore a text node - the old text is not defined on the node. Has the node been changed after text scrambling?..");
			} else {
				if(el._thisIsAControl){
					if(el._replPlaceholder){
						el.placeholder = el._oldText;
					}else{
						el.value = el._oldText;
					}
				}else{
					el.nodeValue = el._oldText;
				}
			}
		};
		var restoreTexts = function(){ // default restore F
			txtNodeStore.forEach(_restoreTxtNodeVal);
		};
		function getJqEls(txtGr = "all"){
			return window.domGetters.getTxtGr(txtGr).filter((i, el)=>{
				return document.body.contains(el); // we may have changed DOM somewhere upstream (e.g., due to 'computed' controls replaced with white divs, etc.), so 'removed' elements shouldn't be touched --> just ignore/filter them out
			});
		};
		var jqAllEls = getJqEls("all");
		switch (variant.txt) {
			// case SCRAMBLE_VARIANTS.TXT.BLACK_CHAR :{ // The same effect as blackBg? // DOESN"T WORK
			// 	jqAllEls = getJqEls("allNoCntrlNoCompCntrl");
			// 	f = txt2blackChar;
			// 	const _defRestoreTexts = restoreTexts;
			// 	restoreTexts = ()=>{
			// 		_defRestoreTexts();
			// 		window.__restoreCSSPropJqArr(jqAllEls, "color");
			// 	};
			// 	break;
			// }
			case SCRAMBLE_VARIANTS.TXT.BLACK_BG :{
				let bgChgEls;
				const blackBgParenEls = []; // we'll keep references here, so we don't repeat blackening if an el has several text nodes <-- each txt node is passed separately in "_setTxtNodeVal"
				dataReqProm = window.domGetters.getOtherGrPromise("bgColChange").then(jqBgCng=>{
					bgChgEls = jqBgCng.toArray();
				});
				jqAllEls = getJqEls("allNoCntrlNoCompCntrl"); // DO we need to filter out Controls from this? <== Not really, they are probably going to be overwritten by controls' black painting // <== but we do filter out anyway
				_setTxtNodeVal = (el, noUseModF, {ifControl} = {ifControl: false})=>{
					if(ifControl){
						return; // do nothing for controls
					}
					// request bgColSet elements as a promise instead of this "__bgRGBcol" reference check -- this is a wonky haphazard solution because of my tiredness
					// check if bgCol is set/changed on the parent node -- then blacken the entire parent instead of wrapping texts in spans
					if(bgChgEls.includes(el.parentElement) && !blackBgParenEls.includes(el.parentElement)){
						blackBgParenEls.push(el.parentElement);// saving a ref, so we don't repeat blackening if el.parentElement has several text nodes
						// TODO: use __setBlackBg2Contents instead here
						cssToRestore.push(...Object.keys(BLACK_TXT_STYLES).map(cssProp=>___getCssVals(el.parentElement, cssProp)));
						__enforceCSSVals(el.parentElement, BLACK_TXT_STYLES);
						// __enforceCSSVals(el.parentElement, {"background-color": "black", "background-image": "none", "color": "transparent", "text-shadow": "none", "border-color": "black"});
					}else{
						const span = __makeBlackSpan(el.nodeValue);
						el.replaceWith(span);
						txtNodeStore.push({span: span, txt: el});
						// check for the rare case of textNodes computing to 0 height for some fonts
						if(window._getTextNodeBBox(span.childNodes[0]).height === 0){
							__enforceCSSVals(span, {"font-family": "Times"}); // Or some other random font family
						}
					}
				};
				restoreTexts = ()=>{
					txtNodeStore.forEach(pair => {
						pair.span.replaceWith(pair.txt);
					});
					__restoreCssVals(cssToRestore);
				};
				break;
			}
			// case SCRAMBLE_VARIANTS.TXT.BLACK_BG_NO_BTWLINES :{
			// 	jqAllEls = getJqEls("allNoCntrlNoCompCntrl");
			// 	_setTxtNodeVal = (el, noUseModF, {ifControl} = {ifControl: false})=>{
			// 		if(ifControl){
			// 			return; // do nothing for controls
			// 		}
			// 		const span = __makeBlackSpansPerLetter(el);
			// 		el.replaceWith(span);
			// 		txtNodeStore.push({span: span, txt: el});
			// 	};
			// 	restoreTexts = ()=>{
			// 		txtNodeStore.forEach(pair => {
			// 			pair.span.replaceWith(pair.txt);
			// 		});
			// 	};
			// 	break;
			// }
			case SCRAMBLE_VARIANTS.TXT.NORMAL : {
				return () => {/*noop*/ }; // do nothing, return a no-op restoration function
			}
			case SCRAMBLE_VARIANTS.TXT.RANDOM_CHARS: {
				f = txt2randomChars;
				break;
			}
			case SCRAMBLE_VARIANTS.TXT.RANDOM_REPLACE : {
				f = txt2randomScramble;
				break;
			}
			case SCRAMBLE_VARIANTS.TXT.NON_ENGLICH: {
				f = txt2nonEnglishRandom;
				break;
			}
			default: {
				throw new Error("Unknown text scramble algorithm: ", variant.txt);
			}
		}
		// NOTE: I'm rather concerned for the element width after character replacement - I hope it doesn't move UI elements around
		// scramble text for each text node we can have
		return dataReqProm.then(()=>{
			jqAllEls.each(function(jqI, el) {
				if (el.nodeType === 3) {
					_setTxtNodeVal(el, f);
				} else if(el.value){
					// this is a control elements, not simple texts
					_setTxtNodeVal(el, f, {ifControl: true});
				} else {
					for (var i = el.childNodes.length; i--;) {
						const subEl = el.childNodes[i];
						if (subEl.nodeType === 3) {
							_setTxtNodeVal(subEl, f);
						}
					}
				}
			});
			return restoreTexts;
		});
		
	}

	// --------------- TXT processing above ------------------
	// --------------- IMG processing below ------------------

	// No longer needed - we are already doing it for all visible elements upstream
	//	function __zeroTransitionAnimation(allGraphRes, allBgCnvsRes){
	//		// Use it before any image-related modifications - so they are immediately visible
	//		allGraphRes.concat(allBgCnvsRes).forEach(x=>{
	//			x.el.style.setProperty("transition", "all 0s 0s", "important");
	//			x.el.style.setProperty("animation-duration", "0s", "important");
	//			x.el.style.setProperty("animation-delay", "0s", "important");
	//		});
	//	}
	function __getElStValObj(el, prop) {
		return {
			el: el,
			property: prop,
			value: el.style.getPropertyValue(prop),
			priority: el.style.getPropertyPriority(prop)
		};
	}
	
	function __body2Blur(bgGraphArr){
		// <body> and <html> can't have filter applied to their background img -- we have to use a work-around (which would be too difficult to implement as a main solution for other elements due to positioning/sizing)
		const bgNodeStore = [];
		const sharedStyles = {
			"content": '""',
			"position": "absolute",
			"top": 0,
			"left": 0,
			"width": "100%", // I don't care about offsetting border... Too much hustle
			"height": "100%",
			"filter": `blur(${BLUR_RADIUS}px)`
		};
		const bgSt2Copy = ['background-attachment', 'background-clip', 'background-color', 'background-image', 'background-origin', 'background-position', 'background-repeat', 'background-size'];
		const cssInjctr = new window.CssInjector();
		bgGraphArr.forEach((graphObj, i) => {
			const st = window.getComputedStyle(graphObj.el);
			const stBef = window.getComputedStyle(graphObj.el, "::before");
			const stAft = window.getComputedStyle(graphObj.el, "::after");
			const stToEnf = Object.assign(sharedStyles, __cssValsToObj(st, bgSt2Copy));
			var pseudoKey = "::before";
			if(stBef["content"] !== "none"){
				if(stAft["content"] !== "none"){
					console.error("[SCRAMBLE] We are out of luck! Both before/after pseudo elements exist for a ", graphObj.el.tagName, " with a background-image set ==> We'll replace the before element; let's hope it won't change anything major, but otherwise --> filter out this page from studies");
				}else{
					pseudoKey = "::after";
					stToEnf["z-index"] = "-1"; // let's hope this is enough to put it underneath the rest of content
				}
			}
			cssInjctr._injectCss1Element(graphObj.el, pseudoKey, Object.fromEntries(Object.entries(stToEnf).map(([k, v])=>[k, v + " !important"])));
			// NOTE: more of body will be visible than our pseudo element -- we can't do anything if body is set to 100% height (aka, the height of viewport) ==> Removing the original background-image so it's not peeking from underneath (also at the corners, which don't get blurred and are partially transparent)
			bgNodeStore.push(__getElStValObj(graphObj.el, "background-image"));
			graphObj.el.style.setProperty("background-image", 'none', "important");
		});
		return ()=>{
			cssInjctr._removeAllCss();
			bgNodeStore.forEach(elObj => {
				elObj.el.style.setProperty(elObj.property, elObj.value, elObj.priority);
			});
		};
	}

	function _2imgBlur(allGraphRes, allBgCnvsRes) {
		// 1 - Store references to changed nodes
		const nodeStore = [];
		const bgNodeStore = [];
		// 2 - Set filter: blur(5px) 
		allGraphRes.forEach(x => {
			nodeStore.push({
				el: x.el,
				filterValue: x.el.style.getPropertyValue("filter"),
				priority: x.el.style.getPropertyPriority("filter")
			});
			x.el.style.setProperty("filter", `blur(${BLUR_RADIUS}px)`, "important"); // This works on all elements, not just images
		});
		// 3.1 - blur bg for body/html
		const _bodyHtml = ["body", "html"];// maybe in the future I have add smth else?...
		const blurWithPseudoEls = allBgCnvsRes.filter(x=>_bodyHtml.includes(x.el.tagName.toLowerCase()));
		const revertPseudoElBlurF = blurWithPseudoEls.length?__body2Blur(blurWithPseudoEls):()=>{};
		// 3.2 - replace bg with blurred bg images
		const aPromise = allBgCnvsRes.filter(x=>!_bodyHtml.includes(x.el.tagName.toLowerCase())).reduce((p, x) => {
			return p.then(()=>{
				// 3.1 - Save old values
				bgNodeStore.push(__getElStValObj(x.el, "background-image"));
				bgNodeStore.push(__getElStValObj(x.el, "background-repeat"));
				bgNodeStore.push(__getElStValObj(x.el, "background-size"));
				bgNodeStore.push(__getElStValObj(x.el, "background-position"));
				bgNodeStore.push(__getElStValObj(x.el, "background-origin"));
				// 3.2 - Make bg element blurred
				const oldFilterVals = __getElStValObj(x.el, "filter");
				x.el.style.setProperty("filter", `blur(${BLUR_RADIUS}px)`, "important");
				// 3.3 - Take a screenshot of the element
				return window._el2canvasWhiteBgNoOverlaysAsync(x.el, x.b, true).then(cnvs=>{
					const bgImgDat = cnvs.toDataURL();
					// 3.3 - Make it unblurred again
					x.el.style.setProperty("filter", oldFilterVals.value, oldFilterVals.priority);
					return bgImgDat;
				}).then((bgImgDat)=>{
					// 3.4 - Wait for the image to be decoded
					const img = new Image();
					img.src = bgImgDat;
					return img.decode().then(() => {
						// 3.4 - Replace bg with a blurred version
						x.el.style.setProperty("background-image", 'url("' + img.src + '")', "important");
						x.el.style.setProperty("background-repeat", "no-repeat", "important");
						x.el.style.setProperty("background-size", 'contain', "important");
						x.el.style.setProperty("background-position", '0% 0%', "important");
						x.el.style.setProperty("background-origin", 'border-box', "important");
					});
				});
			});
		}, Promise.resolve());
		// Resolve with as a restore function
		return aPromise.then(() => {
			return () => {
				nodeStore.forEach(elObj => {
					try {
						elObj.el.style.setProperty("filter", elObj.filterValue, elObj.priority);
					} catch (err) {
						console.error(err); // Maybe we'll get errors that we shouldn't react to, e.g., if js has removed an item in the meantime - despite we've disabled timeouts/intervals
					}
				});
				bgNodeStore.forEach(elObj => {
					elObj.el.style.setProperty(elObj.property, elObj.value, elObj.priority);
				});
				revertPseudoElBlurF();
			};
		});
	}

	function _2emptySpace(allGraphRes, allBgCnvsRes) {
		const nodeStore = [];
		// set opacity to 0
		allGraphRes.forEach(x => {
			nodeStore.push({
				el: x.el,
				propName: "opacity",
				value: x.el.style.getPropertyValue("opacity"),
				priority: x.el.style.getPropertyPriority("opacity")
			});
			x.el.style.setProperty("opacity", "0", "important");
		});
		// remove background image
		allBgCnvsRes.forEach(x => {
			nodeStore.push({
				el: x.el,
				propName: "background-image",
				value: x.el.style.getPropertyValue("background-image"),
				priority: x.el.style.getPropertyPriority("background-image")
			});
			x.el.style.setProperty("background-image", "none", "important");
		});
		// Resolve with as a restore function
		return Promise.resolve(() => {
			nodeStore.forEach(elObj => {
				try {
					elObj.el.style.setProperty(elObj.propName, elObj.value, elObj.priority);
				} catch (err) {
					console.error(err); // Maybe we'll get errors that we shouldn't react to, e.g., if js has removed an item in the meantime - despite we've disabled timeouts/intervals
				}
			});
		});
	}

	function __ajustBRectForPadding(bRect, el) { // TODO: replace with a universal f
		const _propsToCheck = ["paddingTop", "paddingLeft", "paddingBottom", "paddingRight", "borderBottomWidth", "borderTopWidth", "borderLeftWidth", "borderRightWidth"];
		const st = window.getComputedStyle(el);
		const padObjVals = {};
		_propsToCheck.forEach(prop => {
			let val = parseFloat(st[prop]);
			if (isNaN(val)) {
				console.error("A NaN value for ", prop, ":", st[prop]); // I'm not sure in what cases it'd be, since it's always supposed to resolve to a numeric value, but we should check
				val = 0;
			}
			padObjVals[prop] = val;
		});
		bRect.width -= padObjVals.paddingLeft + padObjVals.paddingRight + padObjVals.borderLeftWidth + padObjVals.borderRightWidth;
		bRect.height -= padObjVals.paddingTop + padObjVals.paddingBottom + padObjVals.borderTopWidth + padObjVals.borderBottomWidth;
		return bRect;
	}

	function __createDivToCoverEl(el) { //NOTE: we won't use it, and instead replace an el with a copy-all-styles div - We can't deal with overflow-hidden if we cover (the div covers more area than the user acually sees)
		const divRect = window._getAbsBoundingRect(el);
		const adjDivRect = __ajustBRectForPadding(divRect, el);
		// 2 - Checking for unusual situations - no-content elements
		if (adjDivRect.height <= 0 || adjDivRect.width <= 0) {
			console.error("Zero or negative width/height element to cover --> skipping it, bbox: ", adjDivRect);
			return;
		}
		// 3 - Calc a z-index for the div
		const divZ = Math.max(window._getZIndexAsArr(el)); // We just choose the largest - it's enough to ensure that the element is covered 
		// We won't recreate the entire Z-index chain, since we hope that it'd only address a tiny fraction of overlapping-element-with-overlapping-z-values cases // <== No need for +1, since we'll add divs to the end of document
		// 4 - Create and Configure a div to cover an element
		const div = document.createElement("div");
		div.style.setProperty("z-index", divZ, "important");
		div.style.setProperty("position", "absolute", "important");
		div.style.setProperty("top", adjDivRect.top + "px", "important");
		div.style.setProperty("left", adjDivRect.left + "px", "important");
		div.style.setProperty("width", adjDivRect.width + "px", "important");
		div.style.setProperty("height", adjDivRect.height + "px", "important"); // Should I add a pixel for reliability?...
		return div;
	}

	function __enforceCSSVals(el, cssValObj) {
		Object.keys(cssValObj).forEach(prop => {
			el.style.setProperty(prop, cssValObj[prop], "important");
		});
	}

	function __cssValsToObj(styleDecl, propArr) { // Subselects and Puts CSS styles in an object with detectable/iterable keys
		const res = {};
		propArr.forEach(prop => {
			res[prop] = styleDecl[prop];
			if (styleDecl[prop] === undefined) {
				console.error("Property ", prop, " is undefined on a CSSStyleDeclaration object");
			}
		});
		return res;
	}

	//	function __divStylesToCopy(st){
	//		return ["width", "height", "position", "top", "left", "right", "bottom", "z-index", "float", "display", "writing-mode", "direction"].concat([...st].filter((cssProp)=>{
	//			//, "border", "margin-top", "margin-left", "margin-right", "margin-bottom"
	//			return cssProp.indexOf("border-") > -1 || cssProp.indexOf("padding-") > -1 || cssProp.indexOf("margin-") > -1;
	//		}));
	//	}
	
	function __isChildLargerThanParent(el){
		// checks if an element has a) a single child, and b) that child is larger than the parent -- needed for correct blackening inline elements that contain replaced/padded/non-inline elements
		if(el.children.length !== 1){
			return false; // multiple or zero children
		}
		const b = window._getFloatProofBBox(el);
		const chB = window._getFloatProofBBox(el.children[0]);
		return chB.height * chB.width > b.height * b.width;
	}
	
	// function __getNonAutoSizesToEnforce(origEl, st = null){
	// 	// to be used in __img2backgroundAsync -- empty divs with "auto" width/height occupy no space -- but CSS can have content in origEl set with "content" <-- enforce div sizes in such cases
	// 	st = st || window.getComputedStyle(origEl);
	// 	if(st["height"].indexOf("auto") > -1 || st["width"].indexOf("auto") > -1){
	// 		const b = window._getInnerBBox(origEl, false, {handleFloats: true}); // innerBBox because margins/borders are enforced on an external wrapper div and we don't need to count them in // NOTE: handling floats -- otherwise inline controls don't wrap around their internal images
	// 		return {width: b.width + "px", height: b.height + "px"};	
	// 	}
	// 	return {};
	// }

	// function __getNonAutoSizesToEnforce(origEl, st = null, settings = {coverInternPadding: false}){
	// 	// to be used in __img2backgroundAsync -- empty divs with "auto" width/height occupy no space -- but CSS can have content in origEl set with "content" <-- enforce div sizes in such cases
	// 	st = st || window.getComputedStyle(origEl);
	// 	var outObj = {};
	// 	if(st["height"].indexOf("auto") > -1 || st["width"].indexOf("auto") > -1){
	// 		if(settings.coverInternPadding && st["display"] !== "inline"){
	// 			// when we have only a single div -- no inside div to respect padding/border ==> get full bbox, but only if display !== inline; otherwise padding is ignored
	// 			const b = window._getFloatProofBBox(origEl);
	// 			outObj = {width: b.width + "px", height: b.height + "px", "box-sizing": "border-box"};
	// 		}else{
	// 			// NOTE: I'm not sure box-sizing is harmonized for the 2-div solution
	// 			const b = window._getInnerBBox(origEl, false, {handleFloats: true}); // innerBBox because margins/borders are enforced on an external wrapper div and we don't need to count them in // NOTE: handling floats -- otherwise inline controls don't wrap around their internal images
	// 			outObj =  {width: b.width + "px", height: b.height + "px"};	
	// 		}
	// 	}
	// 	return outObj;
	// }
	
	function __getNonAutoSizesToEnforce(origEl, st = null){
		// to be used in __img2backgroundAsync -- empty divs with "auto" width/height occupy no space -- but CSS can have content in origEl set with "content" <-- enforce div sizes in such cases
		st = st || window.getPreComputedStyles(origEl);
		// st = st || window.getComputedStyle(origEl);
		var outObj = {};
		if(st["height"].indexOf("auto") > -1 || st["width"].indexOf("auto") > -1){
			if(st["display"] !== "inline"){
				// when we have only a single div -- no inside div to respect padding/border ==> get full bbox, but only if display !== inline; otherwise padding is ignored
				const b = window._getFloatProofBBox(origEl, {enforceHeight2Content: true});
				outObj = {width: b.width + "px", height: b.height + "px", "box-sizing": "border-box"};
			}else{
				// NOTE: I'm not sure box-sizing is harmonized for the 2-div solution
				const b = window._getInnerBBox(origEl, false, {handleFloats: true, enforceHeight2Content: true}); // innerBBox because margins/borders are enforced on an external wrapper div and we don't need to count them in // NOTE: handling floats -- otherwise inline controls don't wrap around their internal images
				outObj =  {width: b.width + "px", height: b.height + "px"};	
			}
		}
		return outObj;
	}
	
	function __isItFile(el){
		return el.tagName.toLowerCase() === "input" && el.type === "file";
	}
	
	function __unwrapInlineContainer(el2rep){
		// replaced elements and non-inline elements shift other content - so we should replace them instead of their inline parent
		// const st = window.getComputedStyle(el2rep);
		const st = window.getPreComputedStyles(el2rep);
		if(st["display"] === "inline"){
			// FIXME: check iteratively - not just the 1st nested child
			// FIXME: have a multi-child version?.. Too much hustle now
			if(__isChildLargerThanParent(el2rep)){
				const ch = el2rep.children[0];
				const chSt = window.getComputedStyle(ch);
				if(window._tagSets.replacedElements.has(ch.tagName.toLowerCase()) || chSt["display"] !== "inline"){ // this is mostly about images inside inline elements, like <a>
					// use the child element instead -- it moves content around, not the parent
					el2rep = ch;
				}
			}
		}
		return el2rep;
	}

	function __img2backgroundAsync(allGraphRes, allBgCnvsRes, bgAsImgUrl, bgCalcFAsync, settings = {coverInternPadding: false}) {
		// -3 - process pseudo element separately - they require injecting CSS
		const psdElsToRepl = allGraphRes.filter(x=>(x.el.__pseudoType && x.el.__pseudoType === "glyph" && !x.el.__wasPseudoEl));
		allGraphRes = allGraphRes.filter(el=>!psdElsToRepl.includes(el));
		var psdRestoreF; // keeping a reference
		const psdRepProm = __img2bgForPseudosAsync(psdElsToRepl, bgAsImgUrl, bgCalcFAsync).then(_psdRestoreF=>{
			console.assert(typeof _psdRestoreF === "function", "We didn't return a DOM restore function for pseudo-element graphics", window.location.href);
			psdRestoreF = _psdRestoreF;
		});
		// -2 - get needed collections
		const cntrlsWithTextEls = window.domGetters.getTxtGr("cntrlOnly").add(window.domGetters.getCntrlGr("_cmpBtn")).toArray(); // needed for some obscure leading estimation
		// -1 - styles we need to copy to match a div with img
		const stToCopy = ["top", "left", "right", "bottom"]
			.map(x=>{
				return [`${x}`, `border-${x}-color`, `border-${x}-style`, `border-${x}-width`, `margin-${x}`, `padding-${x}`];
			})
			.flat()
			.concat(["border-bottom-left-radius", "border-bottom-right-radius", "border-collapse",    "border-spacing",  "border-top-left-radius", "border-top-right-radius"])
			.concat(["opacity", "width", "height", "position", "z-index", "float", "display", "writing-mode", "direction", "vertical-align", "visibility", "box-sizing", "font-size", "transform", "transform-origin", "perspective", "perspective-origin", "transform-style"]);
		// 0 - remember items to recover
		const nodeBgStore = [];
		const divStore = [];
		const siblingCleanUpFStore = [];
		// 1 - Cover with Divs
		const allGraphPresPr = allGraphRes.reduce((p, x) => {
			return p.then(()=>{
				const outerDiv = document.createElement("div");
				outerDiv._thisIsAReplacedDiv = true;
				var el2rep = (settings.coverInternPadding)?__unwrapInlineContainer(x.el):x.el;
				// const st = window.getComputedStyle(el2rep);
				const st = window.getPreComputedStyles(el2rep);
				// get styles to apply to an external div/placeholder
				const _stCpy = __cssValsToObj(st, window.__getAllCssPropList());
				var stToEnf = __cssValsToObj(st, stToCopy); //__cssValsToObj(st, [...st]);
				stToEnf = Object.assign(stToEnf, __getNonAutoSizesToEnforce(el2rep, st)); // "auto" width/height are zero when applied to divs
				// otherwise copy all, with [...st]
				// display:inline make our div height to collapse ==> replace with inline-block if needed
				if (stToEnf.display === "inline") {
					stToEnf.display = "inline-block";
					// top/bottom margins are ignored for inline elements -- zero them for our inline-block
					if(el2rep.innerText && el2rep.innerText.length){ // I guess they are only ignored for text elements - probably has to do with leading estimation
						stToEnf["margin-bottom"] = "0px";
						stToEnf["margin-top"] = "0px";	
					}
					// manually apply inline-element's lineHeight to the parent -- if it has none set (i.e., "normal")
					if(st["line-height"] !== "normal" && el2rep.parentElement){
						const pSt = window.getComputedStyle(el2rep.parentElement);
						if(pSt["line-height"] === "normal"){ // i.e., not set
							nodeBgStore.push(___getCssVals(el2rep.parentElement, "line-height"));
							el2rep.parentElement.style.setProperty("line-height", st["line-height"], "important");
						}
					}
				}
				stToEnf.backgroundImage = "none";
				// ensuring that our divs aren't replaced with "content"
				stToEnf.content = "none";
				__enforceCSSVals(outerDiv, stToEnf);// ensure our div is properly positioned/sized
				// 2 - make internal div occupy all of the space
				var div;
				if(settings.coverInternPadding){
					div = outerDiv; // we'll paint the outer div
				}else{
					div = document.createElement("div");
					div._thisIsAReplacedDiv = true;
					__enforceCSSVals(div, {
						"width": "100%",
						"height": "100%",
						"padding": "0",
						"margin": "0",
						"border-width": "0",
						"content": "none"
					});
					if(stToEnf.display === "table" || stToEnf.display === "inline-table"){ // to make sure "height": "100%" is respected
						// IS it really a special case? Should use simply use "display:inherit" for all cases? Is it going to break something if I do?...
						__enforceCSSVals(div, {display: "table-cell"});
					}
					outerDiv.appendChild(div);	
				}
				// 2.5 - add textContent <-- adding content affects/sets a parent's 'baseline', so it's elements are properly aligned (since the default alignment for inline-block elements is "baseline")
				if(el2rep.innerText || cntrlsWithTextEls.includes(el2rep) || __isItFile(el2rep)){ // only for replaceing text-containing elements -- otherwise leading is screwed up again for images
					div.textContent = ".";
					__enforceCSSVals(div, {"color": "transparent"}); // so the "." isn't visible	
				}
				// 3 - Set background-image
				var getBgImgColPr;
				if (bgAsImgUrl) {
					div.style.setProperty("background-image", bgAsImgUrl, "important");
					div.style.setProperty("background-repeat", "repeat", "important");
					getBgImgColPr = Promise.resolve();
				} else {
					getBgImgColPr = bgCalcFAsync(x).then(bgObj=>{
						let {
							bgCol,
							bgImg
						} = bgObj;
						div.style.setProperty("background-image", bgImg, "important");
						div.style.setProperty("background-repeat", "repeat", "important");
						div.style.setProperty("background-color", bgCol, "important");
					});
				}
				// 4 - Copy El's children - just in case they are renderable
				// No, actually we won't copy children - none of the graphical elements are supposed to have children, and we don't want to show fallback error messages, as in <video>
				return getBgImgColPr.then(()=>{
					// 5 - Replace
					const ph = window.getScrlEl().scrollHeight;
					el2rep.replaceWith(outerDiv);
					if(ph !== window.getScrlEl().scrollHeight){
						// trying to revert potential changes to siblings due to replacement
						const siblings = Array
							.from(outerDiv.parentElement.querySelectorAll("*")) // changes may also apply due to nth-child and nth-of-type <-- so selecting all, not just siblings
							.filter(x=>!x._thisIsAReplacedDiv); // no point checking other outerDivs
						siblingCleanUpFStore.push(window.revert2PreCompStyles(siblings));
					}
					// Some more tricks to try to restore size/position changes
					const tricks2restore = __textOrNoText(ph, div, el2rep, outerDiv, _stCpy);
					if(tricks2restore.length){
						nodeBgStore.push(...tricks2restore);
					}
					divStore.push({
						div: outerDiv,
						repEl: el2rep
					});
				});
			});
		}, psdRepProm);
		// 4 - Replace bg-image for background elements
		const allBgPr = allGraphPresPr.then(()=>{
			return allBgCnvsRes.reduce((p, x) => {
				nodeBgStore.push(___getCssVals(x.el, "background-image"));
				nodeBgStore.push(___getCssVals(x.el, "background-repeat"));
				nodeBgStore.push(___getCssVals(x.el, "background-size"));
				nodeBgStore.push(___getCssVals(x.el, "background-position"));
				var aPromise;
				if (bgAsImgUrl) {
					x.el.style.setProperty("background-image", bgAsImgUrl, "important");
					aPromise = Promise.resolve();
				} else {
					nodeBgStore.push(___getCssVals(x.el, "background-color"));
					aPromise = bgCalcFAsync(x).then(bgObj=>{
						let {
							bgCol,
							bgImg
						} = bgObj;
						x.el.style.setProperty("background-image", bgImg, "important");
						x.el.style.setProperty("background-color", bgCol, "important");
					});
				}
				return aPromise.then(()=>{
					x.el.style.setProperty("background-repeat", "repeat", "important"); // if it's a bg image, we should repeat it
					x.el.style.setProperty("background-size", "unset", "important");
					x.el.style.setProperty("background-position", "unset", "important");
				});
			}, Promise.resolve());
		});
		return allBgPr.then(()=>{
			return function restoreDomF() {
				//			console.log("Calling restoreDomF for placeholder images, divStore.length", divStore.length);
				divStore.forEach(pair => {
					pair.div.replaceWith(pair.repEl);
				});
				__restoreCssVals(nodeBgStore);
				psdRestoreF();
				siblingCleanUpFStore.forEach(f=>f());
			};
		});
	}
	
	function __img2bgForPseudosAsync(pseudoGrEls, bgAsImgUrl, bgCalcFAsync){
		// NOTE: pseudo elements are almost always icons, so they never need scrambling in practice -- otherwise I should implement the same F for other scrambling methods
		// NOTE: this F is identical to the bg part of __img2backgroundAsync, but uses CSS injection and cleans up simply by deleting all injected CSS
		const cssInjctr = new window.CssInjector();
		return pseudoGrEls.reduce((p, grObj) => {
			const el = grObj.el;
			console.assert(el.__pseudoType === "glyph" && el.__pseudoPrx, "Expected a pseudo-element graphic/icon, instead: ", window.__el2stringForDiagnostics(el));
			const st2enforce = {
				"color": "transparent !important",
				"background-repeat": "repeat !important",
				"background-size": "unset !important",
				"background-position": "unset !important"
			};
			var aPromise;
			if (bgAsImgUrl) {
				st2enforce["background-image"] = bgAsImgUrl + " !important";
				aPromise = Promise.resolve();
			} else {
				aPromise = bgCalcFAsync(grObj).then(({bgCol, bgImg})=>{
					st2enforce["background-image"] = bgImg + " !important";
					st2enforce["background-color"] = bgCol + " !important";
				});
			}
			return aPromise.then(()=>{
				cssInjctr._injectCss1Element(el, el.__pseudoPrx, st2enforce);
			});
		}, Promise.resolve()).then(()=>{
			return ()=>{
				// returning an F to de-scramble pseudo elements
				cssInjctr._removeAllCss();
			};
		});
	}
	
	function __textOrNoText(ph, div, el, outerDiv, _stCpy){
		// _stCpy is a copy of the replaced element styles
		// some rubbish tricks -- because I don't fully understand how line-height is estimated for what
		const hDiff = Math.abs(ph - window.getScrlEl().scrollHeight);
		const isItWorse = ()=>hDiff < Math.abs(ph - window.getScrlEl().scrollHeight);
		const pSt2Restore = [];
		if(hDiff){
			// I give up on determining what cases should/shouldn't contain text -- just try to reverse it here
			if(div.textContent){
				div.textContent = "";
			}else{
				div.textContent = ".";
				__enforceCSSVals(div, {"color": "transparent"}); // so the "." isn't visible								
			}
			// checking hDiff again - maybe me made it worse
			if(isItWorse()){
				// reverse to the 1st option
				if(div.textContent){
					div.textContent = ".";
				}else{
					div.textContent = "";
				}
			}
			// try enforcing font-size and line-height on parentElement <-- if parent is a block element, this should work if the replaced element had larger values than the parent
			if(ph !== window.getScrlEl().scrollHeight){
				const pSt = window.getComputedStyle(outerDiv.parentElement);
				const _origElLineH = parseFloat(_stCpy["line-height"]);
				const _pLineH = parseFloat(pSt["line-height"]);
				// either font is larger; or line-height is a) set for the replaced element and b) either not set on the parent or is smaller
				if(parseFloat(pSt["font-size"]) < parseFloat(_stCpy["font-size"]) || (!isNaN(_origElLineH) && (isNaN(_pLineH) || _pLineH < _origElLineH))){
					 pSt2Restore.push(___getCssVals(outerDiv.parentElement, "font-size"));
					 pSt2Restore.push(___getCssVals(outerDiv.parentElement, "line-height"));
					__enforceCSSVals(outerDiv.parentElement, {"line-height": _stCpy["line-height"], "font-size": _stCpy["font-size"]});
					if(isItWorse()){
						__restoreCssVals(pSt2Restore);
						pSt2Restore.length = 0;
					}
				}	
			}
			if(ph !== window.getScrlEl().scrollHeight){
				// some more tricks -- try different vertical align
				const initAlign = getComputedStyle(outerDiv)["vertical-align"];
				outerDiv.style.setProperty("vertical-align", "bottom", "important");
				if(isItWorse()){
					outerDiv.style.setProperty("vertical-align", "middle", "important");
					if(isItWorse()){
						outerDiv.style.setProperty("vertical-align", initAlign, "important");
					}
				}
			}
			if(ph !== window.getScrlEl().scrollHeight){
				// some cycling through vertical alignments on the parent
				const _oldStObj = ___getCssVals(outerDiv.parentElement, "vertical-align");
				const possibleVAlignVals = ["top", "middle", "baseline", "bottom", "sub", "super", "text-bottom", "text-top"];
				const _minHDiffI = possibleVAlignVals.map(vAlignVal=>{
					__enforceCSSVals(outerDiv.parentElement, {"vertical-align": vAlignVal});
					return Math.abs(ph - window.getScrlEl().scrollHeight);
				}).reduce((a, x, i, arr)=>{
					return (x < arr[a])?i:a;
				}, 0);
				__enforceCSSVals(outerDiv.parentElement, {"vertical-align": possibleVAlignVals[_minHDiffI]});
				if(isItWorse()){
					__restoreCssVals([_oldStObj]);
				}else{
					pSt2Restore.push(_oldStObj);
				}
			}
			if(ph !== window.getScrlEl().scrollHeight){
				debugger;
				console.error("Element scramble caused page height change, ", window.__el2stringForDiagnostics(el));
			}
		}
		return pSt2Restore;
	}

	function ___getCssVals(el, propName) {
		// utility funtion - converting things/CSS props to a uniform format for restoring later
		return {
			el: el,
			propName: propName,
			value: el.style.getPropertyValue(propName),
			priority: el.style.getPropertyPriority(propName)
		};
	}
	
	function __restoreCssVals(elCssArr){ // elCssArr is created with ___getCssVals above
		elCssArr.forEach((elObj) => {
			elObj.el.style.setProperty(elObj.propName, elObj.value, elObj.priority);
		});
	}

	function _2placeholder(allGraphRes, allBgCnvsRes) {
		// NOTE: the idea of scalable SVG may not work well, especially for backgrounds and very large/small images -- we better try replication with some pattern-like images as bg
		const bgUrl = browser.runtime.getURL("client/images/bg.png");
		const bgVal = "url(" + bgUrl + ")";
		// make sure we only proceed after our BG image is ready to be rendered in all the background elements
		const img = new Image();
		img.src = bgUrl;
		return img.decode().then(() => {
			const restoreDomF = __img2backgroundAsync(allGraphRes, allBgCnvsRes, bgVal);
			return restoreDomF;
		});
	}

	function _2avg(allGraphRes, allBgCnvsRes) {
		const bgUrl = browser.runtime.getURL("client/images/bg.trsp.png"); // so it's not an empty monochromous area, but has wavy pattern
		const bgImg = "url(" + bgUrl + ")";
		//		const _jqOverlays = window._findOverlays(); // We can't keep this here for speeding up <-- some items are removed from DOM
		const img = new Image();
		img.src = bgUrl;
		return img.decode().then(() => {
			return __img2backgroundAsync(allGraphRes, allBgCnvsRes, null, function(elInfo) {
				const cnvsPromise =  elInfo.cnvs? Promise.resolve(elInfo.cnvs): window._el2canvasWhiteBgNoOverlaysAsync(elInfo.el, elInfo.b, false);
				return cnvsPromise.then(cnvs=>{
					const cnvsData = cnvs.getContext('2d').getImageData(0, 0, elInfo.b.width, elInfo.b.height).data;
					const avgRgb = window.__calAvgRGB(cnvsData);
					return {
						bgCol: `rgba(${avgRgb[0]}, ${avgRgb[1]}, ${avgRgb[2]}, 1)`,
						bgImg: bgImg
					};
				});
			});
		}).then((restoreDomF)=>{
			console.assert(typeof restoreDomF === "function", "We didn't return a DOM resstore function", window.location.href);
			return restoreDomF;
		});
	}
	
	// function _binarizeOpacity(nodeObjWraps){
	// 	const restoreElStore = nodeObjWraps.map(x=>{
	// 		return ___getCssVals(x.el, "opacity");
	// 	});
	// 	nodeObjWraps.forEach((x) => {
	// 		const cssOpacity = parseFloat(window.getComputedStyle(x.el).opacity);
	// 		__enforceCSSVals(x.el, {
	// 			"opacity": (isNaN(cssOpacity) || cssOpacity > MIN_VISIBLE_OPACITY)?"1":"0"
	// 		});
	// 	});
	// 	return ()=>{
	// 		__restoreCssVals(restoreElStore);
	// 	};
	// }
	
	function _2blackBox(realNodesObjWraps, bgNodesObjWraps){ // both args are [{el: htmlNode, cnvs:null/cnvsObj, type:string, b:bbox}]
		bgNodesObjWraps.forEach(({type}) => {
			console.assert(type !== window.graphTypes.bgBg, "We should not handle uniform backgrounds here; They are to be set white during pre-processing");
		});		
		// 0 - Update Opacity -- either to 0 or to 1 <-- Should be done before element replacement below <-- but restored last
		// const restoreOpacityF = _binarizeOpacity(realNodesObjWraps.concat(bgNodesObjWraps));
		// 1 - Set colors -- all Black
		return __img2backgroundAsync(realNodesObjWraps, bgNodesObjWraps, null, function(elInfo) {
			return Promise.resolve({
				bgCol: "black",
				bgImg: "none"
			});
		}).then(restoreDomFRealNodes=>{
			console.assert(typeof restoreDomFRealNodes === "function", "We forgot to return a restorer F for DOM", window.location.href);
			return restoreDomFRealNodes;
		});
	}

	function scrambleImg(variant, _urlId) {
		// TODO replace video, iframe etc with images -- copy up all computed styles from elements into this images
		// 1 - Choose a processing function
		var f; // accepts collections of Nodes with names in grTypesToProcess
		var grTypesToProcess = [window.graphTypes.main, window.graphTypes.bgMain];// the default ones
		switch (variant.img) {
			case SCRAMBLE_VARIANTS.IMG.NORMAL: {
				return Promise.resolve(() => {
					/*noop*/ });
			}
			case SCRAMBLE_VARIANTS.IMG.EMPTY_SPACE: {
				f = _2emptySpace;
				break;
			}
			case SCRAMBLE_VARIANTS.IMG.PLCHOLDER: {
				f = _2placeholder;
				break;
			}
			case SCRAMBLE_VARIANTS.IMG.BLUR: {
				f = _2imgBlur;
				break;
			}
			case SCRAMBLE_VARIANTS.IMG.AVG: {
				f = _2avg;
				break;
			}
			case SCRAMBLE_VARIANTS.IMG.AVG_WITH_ICONS: {
				const _zeroTypes = [window.graphTypes.zero, window.graphTypes.bgZero];
				grTypesToProcess = [...window.graphTypes.__allTypesArr].filter(type => !_zeroTypes.includes(type));
				f = _2avg;
				break;
			}
			case SCRAMBLE_VARIANTS.IMG.BLACK_OUT: {
				// add other elements -- all of them, except bgBg because those should be set to white, not black
				grTypesToProcess = [...window.graphTypes.__allTypesArr].filter(type => ![window.graphTypes.bgBg, window.graphTypes.zero, window.graphTypes.bgZero].includes(type));
				f = _2blackBox;
				break;
			}
			default: {
				let err = "Unknown text scramble algorithm: " + variant.img;
				console.error(err);
				Promise.reject(err);
			}
		}
		return window.getGTypeArrAsync(grTypesToProcess).then(_grObjSet=>{
			// Filter out elements that are no longer in DOM ==> Because we temporarely altered the DOM, e.g., because of computed Controls containing some graphics (and these are already replaced with <div>s)
			const grObjSet = Object.fromEntries(Object.entries(_grObjSet).map(([grType, grArr], i)=>{
				return [grType, grArr.filter(x=>document.body.contains(x.el))];
			}));
			// converting collections of graphics Objects to 2 flat arrays - one for 'real' elements, the other for BG <--- It's ugly, but I feel too lazy to update/refactor things now ==> // OPTIMIZE: it
			const allGraphRes = Object.keys(grObjSet).filter((grType)=>!window.graphTypes.isItBg(grType)).reduce((accu, grType)=>{
				
				return accu.concat(grObjSet[grType]);
			}, []);
			const bgCanvases = Object.keys(grObjSet).filter((grType)=>window.graphTypes.isItBg(grType)).reduce((accu, grType)=>{
				return accu.concat(grObjSet[grType]);
			}, []);
			// NOTE: f should resolve with a restore function
			return f(allGraphRes, bgCanvases).then(restoreF => {
				// fool check
				if (typeof restoreF !== 'function') {
					throw new Error("A restore function is not a function: " + restoreF === undefined ? "undefined" : restoreF.toString() + " Method: " + variant);
				}
				console.log("Done scrumbling", _urlId);
				return Promise.resolve(restoreF);
			});
		});
	}
	
	function __setBlackBg2Contents(jqColl){
		// I gave up on trying to replace inline elements with inline-block black divs --> just make the insides black bg
		
		const cssToRestore = jqColl.toArray().map(el=>{
			return Array.from(el.querySelectorAll("*")).concat([el]).map(subEl=>{
				// const css2RestoreSubArr = ["background-image", "background-color", "color", "text-shadow"]
				const css2RestoreSubArr = Object.keys(BLACK_TXT_STYLES).map(cssProp=>___getCssVals(subEl, cssProp));
				__enforceCSSVals(subEl, BLACK_TXT_STYLES);
				// __enforceCSSVals(subEl, {"background-color": "black", "background-image": "none", "color": "black", "text-shadow": "none", "border-color": "black"});
				return css2RestoreSubArr;
			});
		}).flat(2);
		return ()=>{
			debugger;
			__restoreCssVals(cssToRestore);
		};
	}
	
	function _blackOutControlsAsync(variant){
		return window.domGetters.getOtherGrPromise("txtOnlyCntrls").then(jqTxtOnlyCmpCntrls=>{
			// 1 - Get all controls
			const jqAllCntrl = window.domGetters.getCntrlGr("all").not(jqTxtOnlyCmpCntrls);
			// console.warn("REMOVE THE CHECK AFTER DEBUG");
			// console.assert(jqAllCntrl.length === window._filterOutNestedElements(jqAllCntrl).length, "We probably have real controls nested in Computed controls ==> Review my domGetters for Controls", window.location.href);
			// 2 - Convert jq collections to the format needed for __img2background <-- so we can re-use the function
			const cntrlElWraps = jqAllCntrl.toArray().map(el=>{
				return {
					el: el
				};
			});
			var restoreCntrlDomFPromise;
			switch (variant.cntrl) {
				case SCRAMBLE_VARIANTS.CNTRL.BLACK_OUT:
					// 3 - Replace controls with black divs
					restoreCntrlDomFPromise = __img2backgroundAsync(cntrlElWraps, [], null, function(elInfo) {
						return Promise.resolve({
							bgCol: "black",
							bgImg: "none"
						});
					}, {coverInternPadding: true}).then(restoreCntrlDomF=>{
						// 4 - Set black bg to all text-only cmpCntrls
						const restoreF2 = __setBlackBg2Contents(jqTxtOnlyCmpCntrls);
						return ()=>{
							restoreCntrlDomF();
							restoreF2();
						};
					});			
					break;
				default: throw new Error("Unknown variant.cntrl: ", variant.cntrl);
			}
			return restoreCntrlDomFPromise.then(restoreCntrlDomF=>{
				console.assert(typeof restoreCntrlDomF === "function", "_blackOutControls no DOM restorer function returned", window.location.href);
				return restoreCntrlDomF;
			});
		});
	}
	
	function _generalScrambleModsAsync(variant){
		if(variant.img === SCRAMBLE_VARIANTS.IMG.BLACK_OUT && variant.cntrl === SCRAMBLE_VARIANTS.CNTRL.BLACK_OUT){
			// OPTIMIZE: use a 'switch' if needed later --> right now I don't see any uses for this F besides blackOut
			const elsToRestore = [];
			var jqSameBrdBgEls = null;
			var jqBgColSetRef = null; // we should keep the reference, so we can have a 'syncronous' restoration function
			// const spaceDirectionsCss = ["bottom", "top", "left", "right"];
			// 1 - Make Borders Black <-- They are counted as content
			// const pr1 = window.domGetters.getOtherGrPromise("border") <== We should also account for jqBrdCntrls <-- Borders aren't covered by our div-covering approach (it copies borders instead of blackening them)
			const pr1 = Promise
				.all(["border", "borderCntrls"].map(window.domGetters.getOtherGrPromise))
				.then(([jqBrdEls, jqBrdCntrls])=>{
					// NOTE: we utilize el.__presentBorders property to skip re-detecting visible borders -- it's expensive
					jqBrdEls.add(jqBrdCntrls).each((i, el)=>{
						console.assert(el.__presentBorders, "A border element that's returned by window.domGetters.getOtherGrPromise has to have a '__presentBorders' property, but it doesn't, ", window.__el2stringForDiagnostics(el));
						if(el.__presentBorders){
							el.__presentBorders.forEach((side) => {
								const cssColProp = `border-${side}-color`;
								elsToRestore.push(___getCssVals(el, cssColProp));
								__enforceCSSVals(el, Object.fromEntries([[cssColProp, "black"]]));
							});
						}
					});
				});
			// 2 - Some other Props to be set to Black
			const pr2 = pr1.then(()=>{
				const jqAllVis = window.domGetters.getAllVis();
				jqAllVis.each((i, el)=>{
					// const st = window.getComputedStyle(el);
					const st = window.getPreComputedStyles(el);
					const stToChange = {};
					// 2.1 - ensure box-shadow is set to black - unless it's 'none'
					if(st["box-shadow"] !== "none"){
						// elsToRestore.push(___getCssVals(el, "box-shadow"));
						// look for color values
						const shadowCols = st["box-shadow"].match(/(rgb[a]?\([\d, \.]{3,}\))/g);
						let newBoxShadowVal = st["box-shadow"];
						const bgCol = window._cssCol2RgbaArr(st["background-color"]); // FIXME: sample instead of this -- bgImages may be used instead of color
						if(bgCol[3] !== undefined){
							// converting to Canvas alpha -- because window.__are2colorsDiff works only for canvas color
							bgCol[3] *= 255;
						}
						shadowCols.forEach((colStr) => {
							const shadowCol = window._cssCol2RgbaArr(colStr);
							if(shadowCol[3] !== undefined){
								// converting to Canvas alpha -- because window.__are2colorsDiff works only for canvas color
								shadowCol[3] *= 255;
							}
							const alpha = (shadowCol[3] === undefined)?1:shadowCol[3]/255;
							var newCol;
							if(window.__are2colorsDiff(bgCol, shadowCol)){
								// blacken it -- shadow will look similar to a border
								newCol = [0, 0, 0, alpha];
							}else{
								// whiten it -- shadow will look like an extension of this element's background
								newCol = [255, 255, 255, alpha];
							}
							newBoxShadowVal = newBoxShadowVal.replace(colStr, "rgba(" + newCol.join(", ") + ")");
						});
						// const newBoxShadowVal = st["box-shadow"].split(" ").map(str=>{
						// 	if(window._isStringAColor(str)){
						// 		// return "black";
						// 		return _col2BlackButPreserveAlpha(str);
						// 	}
						// 	return str;
						// }).join(" ");
						// set the new value
						console.log("REPLACING SHADOWs from:", st["box-shadow"], "to",  newBoxShadowVal);
						stToChange["box-shadow"] = newBoxShadowVal;
					}
					// 2.2 - ColumnRuleColor
					const columnRuleWidth = parseFloat(st["column-rule-width"]);
					if(!isNaN(columnRuleWidth) && columnRuleWidth > 0){
						// elsToRestore.push(___getCssVals(el, "column-rule-color"));
						// propsToBlackenForThisEl.push("column-rule-color");
						stToChange["column-rule-color"] = _col2BlackButPreserveAlpha(st["column-rule-color"]);
					}
					// 2.3 - OutlineColor
					const outlineWidth = parseFloat(st["outline-width"]);
					if(!isNaN(outlineWidth) && outlineWidth > 0){
						// propsToBlackenForThisEl.push("outline-color");
						stToChange["outline-color"] = _col2BlackButPreserveAlpha(st["outline-color"]);
					}
					// 2.4 - set "scrollbar-color" to black for all elements -- if it's not visible, browser won't render it anyway <-- We should check for the alpha channel...
					if(st["scrollbar-color"] !== "auto"){
						const oldColors = st["scrollbar-color"].split(" rgb");
						if(oldColors[1] !== undefined){
							// if 2 colors were specified, fix the 2nd color
							oldColors[1] = "rgb" + oldColors[1];
						}
						stToChange["scrollbar-color"] = oldColors.map(_col2BlackButPreserveAlpha).join(" ");
					}else{
						stToChange["scrollbar-color"] = "black black";
					}
					// 2.4 - Set/Enforce all the values
					if(Object.keys(stToChange).length){
						Object.keys(stToChange).forEach(cssProps => {
							elsToRestore.push(___getCssVals(el, cssProps));
						});
						__enforceCSSVals(el, stToChange);
					}
				});
			});
			// 3 - Binarize opacity <== No, it'll be done by Matlab later -- also to deal with shadows and color transitions
			// 4 - Set Html bg to White
			const pr3 = pr2.then(()=>{
				// NOTE: background propagation makes a mess of negative zIndexes --> Only set bgCol if it's already set to non-white
				// 4.1 - Choose el to whiten - HTML borrows its color from BODY if bgCol/Img aren't set on HTML
				let rootCnsPaintEl = document.documentElement;
				let hSt = window.getComputedStyle(document.documentElement);
				if(hSt["background-color"] === DEFAULT_BG_COL && hSt["background-image"] === "none"){
					rootCnsPaintEl = document.body;
					hSt = window.getComputedStyle(rootCnsPaintEl);
				}
				if(hSt["background-image"] === "none"){
					elsToRestore.push(___getCssVals(rootCnsPaintEl, "background-color"));
					elsToRestore.push(___getCssVals(rootCnsPaintEl, "background-image"));
					__enforceCSSVals(rootCnsPaintEl, {"background-color": "white", "background-image": "none"});	
				}else{
					console.log("[SCRAMBLE] ", rootCnsPaintEl.tagName, " with imgBg detected --> not whitening it.");
				}
			});
			// 5 - Set all Bg to White
			const pr4 = pr3.then(()=>{
				return Promise.all(["bgColSet", "allPrimitives", "border"].map(window.domGetters.getOtherGrPromise)).then(([jqBgColSet, jqAllPrims, jqBrd])=>{
					// NOTE: we exclude prims from whitening (yes, cmpCntrls can have set bg) - otherwise their initial bgCol gets overwritten and can't be restored when we black them out later
					jqAllPrims = jqAllPrims.filter((i, el)=>{
						// Unless these primitives contain a pseudo-element -- I'm not sure what to do with such elements; they can be anything <-- they should probably be cmpCntrls, but let's whiten them, so that nothing slips through
						return !el.__pseudoType;
					});
					jqBgColSetRef = jqBgColSet.not(jqAllPrims); // preserve the reference 
					window.__setCSSPropJqArr(jqBgColSetRef, "background-image", "none", "important");
					// Utilizing the alpha channel in el.__bgRGBcol for background-color
					jqBgColSetRef.toArray().forEach(el => {
						// const c = window.getPreComputedStyles(el)["background-color"];
						const c = window.getComputedStyle(el)["background-color"];
						// NEW: if a bg element is relatively small, count it as content, not bg
						const looksLikeAThing = window.__isItUI(el);
						window.__setCSSPropJqArr([el], "background-color", _col2BlackButPreserveAlpha(c, {whitenInstead: !looksLikeAThing, avoidDefaultTransparent: true}), "important");
					});
					// window.__setCSSPropJqArr(jqBgColSetRef, "background-color", "white", "important");
					// if brd and bgCol are the same, they aren't counted as brd, and thus, not altered --> get bg els not in brdcoll; check which borders are set; blacken them
					jqSameBrdBgEls = jqBgColSetRef.not(jqBrd).filter(el=>el.__brdCol !== undefined);
					// FIXME: only set border colors for non-empty borders -- not sure if this can cause trouble
					["border-top-color", "border-left-color", "border-right-color", "border-bottom-color"].forEach((brdProp, i) => {
						jqSameBrdBgEls.toArray().forEach(el => {
							const c = window.getComputedStyle(el)[brdProp];
							window.__setCSSPropJqArr([el], brdProp, _col2BlackButPreserveAlpha(c, {whitenInstead: true}), "important");
						});
						// window.__setCSSPropJqArr(jqSameBrdBgEls, brdProp, _col2BlackButPreserveAlpha({whitenInstead: true}), "important");
					});
				});
			});
			// 6 - Blackening all after/before pseudoelements
			const pr5 = pr4.then(()=>{
				return window.domGetters.getGraphGrPromise("icons");
			}).then(jqIcons=>{
				const cssInjctr = new window.CssInjector();
				const borderPropsToBlacken = ["border-top-color", "border-left-color", "border-right-color", "border-bottom-color"];
				const otherPropsToBlacken = ["background-color"]; // note: we don't consider backgroundImage -- image detection should already handle that
				window.domGetters.getAllVis().not(jqIcons).toArray().forEach(el => {
					["::before", "::after"].forEach(pseudoPrefix => {
						const st = window.getComputedStyle(el, pseudoPrefix);
						const thisElPropsToBlacken = otherPropsToBlacken.filter(prop=>{
							return st[prop] !== "rgba(0, 0, 0, 0)"; // if it isn't the default transparent
						}).concat(borderPropsToBlacken.filter(brdProp=>{
							return st[brdProp] !== "rgba(0, 0, 0, 0)" && parseFloat(st[brdProp.replace("color", "width")]) > 0;
						}));
						if(!thisElPropsToBlacken.length){
							return; // nothing to do
						}
						console.warn("Found a pseudoElement to blacken", window.__el2stringForDiagnostics(el));
						const psStObj2Enforce = Object.fromEntries(thisElPropsToBlacken.map(st=>[st, "black"]));
						// // we can't use the style prop --> creating a css rule instead
						// if(!el.id || !el.id.length){
						// 	el.id = window._generateId();
						// }
						// checking if a pseudo element is used as bg
						if(thisElPropsToBlacken.includes("background-color")){
							const MIN_SIZE_PSEUDO_TO_BLACKEN = (window.innerWidth/3) ** 2; // so we don't consider small elements as background
							const w = parseFloat(st["width"]);
							const h = parseFloat(st["height"]);
							if(!isNaN(w) && !isNaN(h) && w*h > MIN_SIZE_PSEUDO_TO_BLACKEN){
								// switch to white background
								console.warn("Whitening pseudo bg instead of blackening");
								psStObj2Enforce["background-color"] = "white";
							}	
						}
						cssInjctr._injectCss1Element(el, pseudoPrefix, psStObj2Enforce);
						// cssInjctr._injectCss("#"+el.id+pseudoPrefix, psStObj2Enforce);
					});
				});
				return cssInjctr;
			});
			// 7 - Pass on a Restorer function
			const pr6 = pr5.then((cssInjctr)=>{
				return ()=>{
					// window.__restoreCssVals(jqBgColSetRef, "background-image");
					window.__restoreCSSPropJqArr(jqBgColSetRef, "background-image");
					// window.__restoreCssVals(jqBgColSetRef, "background-color"); // this f doesn't exist
					window.__restoreCSSPropJqArr(jqBgColSetRef, "background-color");
					["border-top-color", "border-left-color", "border-right-color", "border-bottom-color"].forEach((brdProp, i) => {
						window.__restoreCSSPropJqArr(jqSameBrdBgEls, brdProp);
					});
					__restoreCssVals(elsToRestore);
					cssInjctr._removeAllCss();
				};
			});
			return pr6;
		}
		return Promise.resolve(()=>{}); // a no-op F as a DOM restorer -- we didn't change anything
	}
	
	function _col2BlackButPreserveAlpha(strRgba, settings = {whitenInstead: false, avoidDefaultTransparent: false}){
		const v = (settings.whitenInstead)?255:0;
		const colRgb = (Array.isArray(strRgba))?strRgba.slice():window._cssCol2RgbaArr(strRgba);
		if(settings.avoidDefaultTransparent){
			if(colRgb.every(x=>x === 0)){
				// this is default black-transparent
				return settings.whitenInstead?"white":"black";
			}
		}
		const col = colRgb.fill(v, 0, 3);
		return ((col.length===4)?"rgba(":"rgb(") + col.join(",") + ")";
	}

	function _scramblePage(variant, _urlId) {
		// 0 - Some prepping - in case it hasn't been done yet
		window.toggleDomPrepForInstaManip("on");
		// 1 - Get the name, init restoreF object
		const restFName = getRestoreFName(variant);
		_restoreFStore[restFName] = {};
		// 2 - Modify
		// 2.1 - General DOM/Page modifications (neither of the major groups of elements...)
		var _pH = window.getScrlEl().scrollHeight;
		var prms = _generalScrambleModsAsync(variant).then(genModsRestoreF=>{
			console.assert(_pH === window.getScrlEl().scrollHeight, "1 Page height changed after _generalScrambleModsAsync, from", _pH, "to", window.getScrlEl().scrollHeight, location.href);
			console.assert(genModsRestoreF && typeof genModsRestoreF === 'function', "We didn't pass on a function to restore DOM after _generalScrambleModsAsync", window.location.href);
			_restoreFStore[restFName].gen = genModsRestoreF;
		}).then(()=>{
			// 2.2 - texts
			_pH = window.getScrlEl().scrollHeight;
			return scrambleTextAsync(variant);
		}).then((txtRestoreF)=>{
			console.assert(txtRestoreF && typeof txtRestoreF === 'function', "We didn't pass on a function to restore DOM after scrambleTextAsync", window.location.href);
			_restoreFStore[restFName].txt = txtRestoreF;
			console.assert(_pH === window.getScrlEl().scrollHeight, "2 Page height changed after scrambleText, from", _pH, "to", window.getScrlEl().scrollHeight, location.href);
			if(_pH !== window.getScrlEl().scrollHeight){
				debugger;
			}
		}).then(()=>{
			// 2.3 - images
			_pH = window.getScrlEl().scrollHeight;
			return scrambleImg(variant, _urlId);
		}).then((restoreF) => {
			console.assert(_pH === window.getScrlEl().scrollHeight, "3 Page height changed after scrambleImg, from", _pH, "to", window.getScrlEl().scrollHeight, location.href);
			console.assert(restoreF && typeof restoreF === 'function', "We didn't pass on a function to restore DOM after scrambleImg", window.location.href);
			_restoreFStore[restFName].img = restoreF;
		}); // Returning a Promise
		// 2.1 - If it's black-out -- do controls
		console.assert(variant.img !== SCRAMBLE_VARIANTS.IMG.BLACK_OUT || variant.cntrl !== undefined, "We didn't initialize a 'variant' object properly for black out -- forgot .cntrl <--", variant);
		if(variant.cntrl !== undefined){
			prms = prms.then(()=>{
				// utilize variant.cntrl <== should be a trivial check, just to have a similar structure to other scramble functions
				_pH = window.getScrlEl().scrollHeight;
				return _blackOutControlsAsync(variant).then(cntrlRestoreF=>{
					console.assert(_pH === window.getScrlEl().scrollHeight, "3 Page height changed after _blackOutControlsAsync, from", _pH, "to", window.getScrlEl().scrollHeight, location.href);
					_restoreFStore[restFName].cntrl = cntrlRestoreF;
				});
			});
		}
		return prms;
	}

	function _restorePage(variant) {
		// We implement a restoration-path function for each method - simply cloning DOM doesn't work, because it reloads iframes or makes them empty (if they were created with JS)
		const restFName = getRestoreFName(variant);
		Object.keys(_restoreFStore[restFName]).forEach(k => {
			if (!["gen", "txt", "img", "cntrl"].includes(k)) {
				console.error("Unknown restoration function:", k);
			}
		}); // fool check
		// 1 - run each saved restoration function
		// NOTE: order is important -- ensuring it
		["gen", "txt", "cntrl", "img"].filter(k=>Object.keys(_restoreFStore[restFName]).includes(k)).forEach(k => {
			_restoreFStore[restFName][k]();
		});
		
		// Object.values(_restoreFStore[restFName]).forEach(f => f()); // All our Restoration F are syncronous
		// 2 - remove a restoration function from the store - so we can control for errors, like calling scrambling prior to restoration
		delete _restoreFStore[restFName];
		return undefined;
	}

	window._scramblePage = _scramblePage;
	window._restorePage = _restorePage;
	window.SCRAMBLE_VARIANTS = SCRAMBLE_VARIANTS;
	window.__cssValsToObj = __cssValsToObj;
	window.__enforceCSSVals = __enforceCSSVals;
})();
