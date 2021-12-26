/*eslint-env browser */

(() => {
	const _tagSets = new(function() {
		this.inputTypesWithText = new Set(["datetime-local", "button", "reset", "text", "date", "email", "month", "number", "search", "tel", "time", "url", "week", "datetime", "submit"]);
		this.controls = new Set(["button", "input", "option", "select", "details", "textarea", "audio", "portal"]);
		this.styledAsControls = new Set(["kbd", "hr", "meter", "progress"]);
		this.media = new Set(["img", "object", "video", "canvas", "embed", "picture", "svg"]);
		this.invisible = new Set(["map", "area"]);
		this.controlsCantBeIn = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "cite", "code", "q", "rb", "var"]);
		this.nonMainText = new Set(["label", "output", "legend", "summary"]); // TODO: do we use it actually?... remove otherwise
		this.displayBlockTags = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']); // from https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements
		this.replacedElements = new Set(["iframe", "video", "embed", "img", "audio", "canvas", "object", "applet"]); // NOTE: I don't keep option/inputs here since this Set is only to be used for cmpCntrl blackening out, and option/inputs aren't cmpCntrls
		this.groups = {
			// TODO: check if shadeAdControls is actually used
			shadeAsControls: new Set([...this.styledAsControls].concat(this.controls))
			// headersFooters: new Set(["footer"].concat([...this.headers]))
		};
	})();

	const graphTypes = { // just so I don't mess up with string comparison
		ui: "ui",
		glyph: "glyph",
		bgIcon: "bg.icon",
		bgUi: "bg.ui",
		bgBg: "bg.bg", // not a large colorful pic, but closer to a monochrome bg, substitute for bg color
		bgMain: "bg.main", // devs using bgImg instead of <img>,
		main: "main", // actual pics, core contents
		icon: "icon",
		bgZero: "bg.zero",
		zero: "zero", // something that is so small (e.g., mostly obstructed by other elements) that we don't bother processing it
		// __allTypesArr: null,
		isItBg: function(grTypeStr) {
			return grTypeStr.indexOf("bg.") > -1;
		},
		__foolCheck: function(grTypeStr) {
			console.assert(graphTypes.__allTypesArr.has(grTypeStr), "Unknown graphics type:", grTypeStr);
		}
	};
	graphTypes.__allTypesArr = new Set(Object.values(graphTypes).filter(v => typeof(v) === "string")); // I'm not proud of this init, but I don't care for a more fancy solution now...

	const graphObjStore = {
		_graphObjArr: null, // [{el: htmlNode, b: bbox, cnvs: canvas, type: string}] <-- It's ugly to keep it this way, but I'm trying to avoid re-calculations
		forceRefresh: function() {
			graphObjStore._graphObjArr = null;
			graphObjStore._initPr = null;
		},
		_initPr: null,
		requestCatGraphObjArr: function() {
			if (graphObjStore._graphObjArr === null) {
				if (graphObjStore._initPr === null) {
					console.log("[GROUPING] Initializing GRAPH collections", window.location.href);
					graphObjStore._initPr = new Promise((resolve, reject) => {
						_categorizeGraphicsNew(jqG.getAllVis()).then(graphObjArr => {
							console.log("[GROUPING] Received a graphObjArr object");
							// fool check upon initialization
							graphObjArr.forEach((x) => graphTypes.__foolCheck(x.type));
							// saving for future reuse
							graphObjStore._graphObjArr = graphObjArr;
							// resolve(graphObjStore._graphObjArr);
							resolve();
						}).catch(e => {
							console.error(e);
							throw e;
						});
					});
				}
			}
			return graphObjStore._initPr.then(() => {
				console.log("[GROUPING] Returning a copy of graphObjArr");
				return graphObjStore._graphObjArr.slice(); // a shallow copy, so it's safe to remove/add some elements downstream
			});
		},
		filterDownTo: function(gCatArr) {
			return graphObjStore.requestCatGraphObjArr().then(_graphObjArr => {
				const res = {};
				gCatArr.forEach((gCat) => {
					graphTypes.__foolCheck(gCat);
					res[gCat] = _graphObjArr.filter(gObj => gObj.type === gCat);
				});
				return Promise.resolve(res);
			});
		}
	};

	const MAX_PRIMITIVES_TO_CANCEL_OVERLAYS = 0.25; // 25% primitives can be in overlays -- otherwise these aren't overlays
	const MAX_BG_IMG_NATIVE_SIZE = 20 * 20; // if a bg image's native size is below that, we presume it's used as replicated background
	const MIN_RATIO_BG2EL_NONREPEAT_BG = 0.8; // if a nativeImgSize of a bgImg is 80% of an element size, we count this bgImg as not backgrount, but main img.
	const MAX_CONTROL_MAX_DIM = Math.max(0.13 * window.innerWidth, 120); //px; guessed value;  -- otherwise the brain sees it as collection of things, not a controls
	const MAX_CONTROL_MIN_DIM = Math.max(0.041 * window.innerWidth, 50);
	const MIN_VIS_FONT_SIZE = 3;
	const MAX_SIZE_IFRAME_AS_PRIMITIVE = 150 * 30; // pixels; If larger than this, we classify an iframe as a stand-alone cluster; if less, it's visually a primitive -- and distances need to be calculated for it.
	const MAX_DIFF_TO_DISCARD_BBOXES_COINCIDE = 0.05; // used in overlay detection; when detecting if a hovering/positioned item is used to create layering
	const MAX_SD_NONPIC_BG = 7; // these are arbitrary
	const MAX_SD_NONPIC_BG_WHEN_REPL = MAX_SD_NONPIC_BG * 3.5;
	const IMG_UI_SIZE = 40; // these are arbitrary
	const IMG_UI_SIZE_NONBG = IMG_UI_SIZE / 2;
	const IMG_ICON_SIZE = 48; // px
	const IMG_ICON_SIZE_NONBG = 32; // px
	const N_PIX_2_SAMPLE_FOR_BG = 4; // this is one of the main delays -- keep it minimal
	const LETTER_TO_CHECK_SINGLE_LINENESS = "i";
	const MAX_CONTROL_TXT_NODES = 1; // only one piece of text is allowed, otherwise it's not a control
	const MAX_NON_CONTROL_TXT_IN_PARENT = 0.15; // let's say no more than 15% of parent's text can be not controls, like some special symbols, or a short label
	const MIN_VISIBLE_OPACITY = 0.05; // below that we just count a thing as invisible/fully transparent
	const MIN_VISIBLE_COL_DIFF_TO_COUNT = 0.06 * 255; // cumulative difference across 3 channels
	// var _visibleElementsStore = null; // keeping a reference to all visible elements here - trying to speed up calculations because it's all so slow
	// NOTE: we might also add "input type='image' src='img_submit.gif'" <-- but these are rather likely to be icons/controls, so we'll skip them for now, as I doubt somebody uses them to display complex non-UI graphics

	const jqG = {
		__elStore: {
			allVis: null,
			other: {
				iframe: null,
				iframeAsPrims: null, // used in cluster.prep.js in distance estimation
				iframeStandAlone: null, // used in clustering -- as stand-alone clusters
				allPrimitives: null, // so we exclude overlaps <-- e.g., some <a> qualify as both txt and cntrl
				allPrimitivesNoCmpCntrl: null, // <== Cleanest version; computed Controls themselves consist of primitives
				txtOnlyCntrls: null,
				border: null, // any visible element that has a visible border
				borderMoreThn1Side: null, // some elements have only a single side border - we don't want to count them as group or grouping factor in Hierarchical clustering
				bgColChange: null, // Needed as a grouping factor in HClust <== Incl img as monotonous bg
				bgColSet: null, // Needed in WhSpace estimation
				bgColSetCntrls: null, // Probably only used in postFiltering cmpCntrls
				hoveringItems: null // This includes overlays and elements that are simply positioned (absolute or fixed) -- not sure I'll use this collection, but it's an itermediary step to get Overlays
			},
			cntrl: {
				all: null,
				actionable: null,
				_cmpBtn: null, // composite <button> els
				decorative: null,
				computed: null,
				real: null // actionable + decorative, but not computed
			},
			txt: {
				all: null,
				allNoCntrl: null, // <== Save as a flag + Use in Blacking-out-ing
				allNoCntrlNoCompCntrl: null,
				cntrlOnly: null // probably only used in "scramble.js"
			},
			graphic: {
				// NOTE: we'll use it as wrapper around "graphTypes"
				allNonBgBg: null, // to be saved as primitives
				icons: null,
				main: null,
				allNonZero: null
				// main: null,
				// bgMain: null, // to address designers' of using bg instead of <img>
				// bgBg: null, // <== ONly this one is to be white-out-ed
				// nonInterCntrl: null,
				// icon: null
			},
			semantic: {
				titles: null, // DONE
				headers: null, // DONE
				footers: null, // DONE
				rootEl: null, // A single element - the 1st element (HTML downwards) that contains more than 1 visible child <-- to detect global white-space margins and actual content width
				rootVisChildren: null, // Visible children of rootEl
				socialButtons: null, // DONE
				menusV: null,
				menusH: null,
				menusMixed: null,
				menus: null,
				funcAreas: null, // DONE, but weak implementation
				// loginAreas: null, // DONE, but weak implementation
				logos: null, // DONE
				overlays: null, // DONE // <-- Real ones -- those that have some non-empty/uniform-bg content under them <== Just see if any primitive's bboxes overlap with a potential overlay (hoveringItems above)
				fixedAreas: null,
				forms: null, // DONE
				rotatingBanners: null, // DONE // repetitive structure; only one image is visible at a time; many images
				mainBody: null, // DONE
				mainTxtChunksArr: null // !!! NOT a $ object // DONE // <== Use for text sampling; Save as a flag; save as a group; Compute as mainBody minus forms, controls, menus <== Have a fallback version, with all p content sampled
			}
		},
		__grNames: null,
		get grNames() {
			if (jqG.__grNames === null) {
				const _f = (obj) => {
					const _subRes = {};
					Object.keys(obj).forEach((grName) => {
						if (obj[grName] === null || obj[grName] instanceof window.jQuery) {
							_subRes[grName] = grName; // a string - a group name
						} else {
							console.assert(obj[grName] !== undefined, "we didn't init this group with 'null', do it:", grName);
							_subRes[grName] = _f(obj[grName]); // descend down recursion
						}
					});
					return _subRes;
				};
				jqG.__grNames = _f(jqG.__elStore);
			}
			return jqG.__grNames;
		},
		getAllVis: function() {
			if (jqG.__elStore.allVis === null) {
				jqG.__elStore.allVis = _getVisibleElements();
			}
			return jqG.__elStore.allVis.filter(() => true); // NOTE: filter creates a new JQ object, so the original collection isn't touched			
		},
		getTxtGr: function(subGrName = "all") { // sync F, gets one of txt collections
			console.assert(jqG.__elStore.txt[subGrName] !== undefined, "TXT Group doesn't exist", subGrName);
			if (jqG.__elStore.txt[subGrName] === null) {
				console.log("[GROUPING] Initializing TXT collections", window.location.href);
				// init the whole group
				// debugger;
				const jqAllVisTxt = _filterOutInvisibleText(jqG.getAllVis());
				jqG.__elStore.txt.allNoCntrl = _getOnlyElementsWithText(jqAllVisTxt);
				const jqAllTxtCntrl = _getControlsWithText(jqAllVisTxt);
				jqG.__elStore.txt.cntrlOnly = jqAllTxtCntrl;
				jqG.__elStore.txt.all = jqAllTxtCntrl.add(jqG.__elStore.txt.allNoCntrl);
				const cmpCntrls = jqG.getCntrlGr("computed").toArray();
				jqG.__elStore.txt.allNoCntrlNoCompCntrl = jqG.__elStore.txt.allNoCntrl.filter((i, el) => {
					return cmpCntrls.every(cmpEl => !cmpEl.contains(el));
				});
				// 3.3 - calculating visual inner text for all visible elements
				__assignVisInnerText(jqG.__elStore.txt.all, jqG.getAllVis());
			}
			return jqG.__elStore.txt[subGrName].filter(() => true);
		},
		_graphPr: null,
		getGraphGrPromise: function(subGrName) {
			console.assert(jqG.__elStore.graphic[subGrName] !== undefined, "Other Group doesn't exist", subGrName);
			if (jqG.__elStore.graphic[subGrName] === null) {
				if (jqG._graphPr === null) {
					jqG._graphPr = graphObjStore.requestCatGraphObjArr().then((_graphObjArr) => {
						jqG.__elStore.graphic.icons = $(_graphObjArr.filter(descObj => [graphTypes.icon, graphTypes.bgIcon, graphTypes.glyph].includes(descObj.type)).map(__assignHidPropsToGrEls));
						jqG.__elStore.graphic.allNonBgBg = $(_graphObjArr.filter(descObj => ![graphTypes.bgBg, graphTypes.zero, graphTypes.bgZero].includes(descObj.type)).map(__assignHidPropsToGrEls));
						jqG.__elStore.graphic.main = $(_graphObjArr.filter(descObj => [graphTypes.main, graphTypes.bgMain].includes(descObj.type)).map(__assignHidPropsToGrEls));
						jqG.__elStore.graphic.allNonZero = $(_graphObjArr.filter(descObj => ![graphTypes.zero, graphTypes.bgZero].includes(descObj.type)).map(__assignHidPropsToGrEls));
						// return Promise.resolve(jqG.__elStore.graphic[subGrName]);
					});
				}
			}
			return jqG._graphPr.then(() => {
				return jqG.__elStore.graphic[subGrName].filter(() => true);
			}); // Promise.resolve(jqG.__elStore.graphic[subGrName]);
		},
		_otherPr: null,
		getOtherGrPromise: function(subGrName) { // async F, gets one of primitive collections <-- async because of Graphics group being async
			console.assert(jqG.__elStore.other[subGrName] !== undefined, "Other Group doesn't exist", subGrName);
			if (jqG.__elStore.other[subGrName] === null) {
				if (jqG._otherPr === null) {
					// Primitives -- Graphics require promises
					jqG._otherPr = jqG.getGraphGrPromise("allNonBgBg").then((nonZeroGrphEls) => {
						jqG.__elStore.other.hoveringItems = _findAllPositionedEls();
						jqG.__elStore.other.iframe = jqG.getAllVis().filter("iframe");
						const {
							jqIfrAsPrims,
							jqIfrStandAlone
						} = categorizeIFrames(jqG.__elStore.other.iframe);
						jqG.__elStore.other.iframeAsPrims = jqIfrAsPrims;
						jqG.__elStore.other.iframeStandAlone = jqIfrStandAlone;
						// borders
						const {jqBrdSet, jqBrdCntrls} = getElementWithBorder(jqG.getCntrlGr("all"));
						jqG.__elStore.other.border = jqBrdSet;
						jqG.__elStore.other.borderCntrls = jqBrdCntrls;
						jqG.__elStore.other.borderMoreThn1Side = jqG.__elStore.other.border.filter((i, el) => {
							return el.__presentBorders.length > 1;
						});
						// const nonZeroGrphEls = _graphObjArr.filter(descObj=> ![graphTypes.bgBg, graphTypes.zero, graphTypes.bgZero].includes(descObj.type)).map(x=>x.el);// NOTE: these are raw Nodes, node Jq
						jqG.__elStore.other.allPrimitivesNoCmpCntrl = jqG.getTxtGr("allNoCntrl").add(jqG.getCntrlGr("real")).add(nonZeroGrphEls);
						// cleaning out cmpCntrls from allPrimitives collection
						const _allCntrl = jqG.getCntrlGr("all").toArray();
						const _noCmpCntrlGr = nonZeroGrphEls.toArray().filter(grEl => _allCntrl.every(cntrlEl => !cntrlEl.contains(grEl)));
						jqG.__elStore.other.allPrimitives = jqG.getTxtGr("allNoCntrlNoCompCntrl").add(_noCmpCntrlGr).add(_allCntrl); // cmpCntrls can contain text nodes and icons
						// BG color set/change -- also a promise
						// bg change -- find those with bgCol (and no over-writing bgImg) and check (a few) pixel color outside of the element <== We (largely) avoid the mess of z-index and overlays
						return getElsWithBgSetPromise(jqG.getCntrlGr("all")).then(({
							jqBgSet,
							jqBgDif,
							jqBgSetCntrls
						}) => {
							jqG.__elStore.other.bgColChange = jqBgDif;
							jqG.__elStore.other.bgColSet = jqBgSet;
							jqG.__elStore.other.bgColSetCntrls = jqBgSetCntrls;
							// return Promise.resolve(jqG.__elStore.other[subGrName].filter(()=>true));
						});
					});
				}
			}
			return jqG._otherPr.then(() => {
				return jqG.__elStore.other[subGrName].filter(() => true);
			}); // Promise.resolve(jqG.__elStore.other[subGrName].filter(()=>true));
		},
		getCntrlGr: function(subGrName) {
			console.assert(jqG.__elStore.cntrl[subGrName] !== undefined, "Cntrl Group doesn't exist", subGrName);
			if (jqG.__elStore.cntrl[subGrName] === null) {
				console.log("[GROUPING] Initializing CONTROL collections");
				// debugger;
				// note: Buttons can have elements/text in them --> move these cases to cmpCntrls
				const jqActCntrls = __filterElementsNoParentMatch(jqG.getAllVis(), _tagSets.controls);
				const btnCmpCntrls = jqActCntrls.filter((i, el) => el.children.length).toArray();
				console.assert(btnCmpCntrls.every(el => el.tagName.toLowerCase() === "button" || el.tagName.toLowerCase() === "select"), "A non-button/select control that has element children in it", btnCmpCntrls);
				jqG.__elStore.cntrl.actionable = jqActCntrls.not(btnCmpCntrls);
				jqG.__elStore.cntrl._cmpBtn = $(btnCmpCntrls);
				jqG.__elStore.cntrl.decorative = __filterElementsNoParentMatch(jqG.getAllVis(), _tagSets.styledAsControls);
				jqG.__elStore.cntrl.real = jqG.__elStore.cntrl.actionable.add(jqG.__elStore.cntrl.decorative);
				const cmpCntrls = window._filterOutNestedElements(btnCmpCntrls.concat(detectNonNativeNonCompoundControls(jqG.getAllVis(), jqG.__elStore.cntrl.real)));
				jqG.__elStore.cntrl.computed = $(cmpCntrls);
				jqG.__elStore.cntrl.all = jqG.__elStore.cntrl.real.add(jqG.__elStore.cntrl.computed);
			}
			return jqG.__elStore.cntrl[subGrName].filter(() => true);
		},
		_semPr: null,
		getSemanticGrPrms: function(subGrName) {
			console.assert(jqG.__elStore.semantic[subGrName] !== undefined, "Semantic Group doesn't exist", subGrName);
			if (jqG.__elStore.semantic[subGrName] === null) {
				if (jqG._semPr === null) {
					jqG._semPr = jqG.getGraphGrPromise("allNonBgBg").then((grElArr) => {
						const {jqOverl, stickyMenus} = _findActualOverlays(grElArr);
						jqG.__elStore.semantic.overlays = jqOverl;
						jqG.__elStore.semantic.fixedAreas = $(stickyMenus);
					}).then(() => {
						// HERE: FIND menus before (!) Titles
						// const jqOverl = jqG.__elStore.semantic.overlays.filter(()=>true);
						return window._semanticGroupDetectors.getMenusAsync().then(({
							v,
							h,
							mixed
						}) => {
							jqG.__elStore.semantic.menusMixed = $(mixed);
							jqG.__elStore.semantic.menusV = $(v);
							jqG.__elStore.semantic.menusH = $(h);
							jqG.__elStore.semantic.menus = $(v.concat(h, mixed));
						});
					}).then(() => {
						return window._semanticGroupDetectors.getTitlesAsync(jqG.__elStore.semantic.overlays, jqG.__elStore.semantic.menus);
					}).then(titleElArr => {
						jqG.__elStore.semantic.titles = $(titleElArr);
					}).then(() => {
						// forming all independent (of other semantic groups) groups here
						return Promise.all([window._semanticGroupDetectors.findRotatingBannersAsync(), window._semanticGroupDetectors.findSocialButtonAreasAsync(jqG.__elStore.semantic.menus)]).then(([bannerElArr, socialButtonsArr]) => {
							jqG.__elStore.semantic.rotatingBanners = $(bannerElArr);

							jqG.__elStore.semantic.socialButtons = $(socialButtonsArr);
						});
					}).then(() => {
						return window._semanticGroupDetectors.findHeadersFootersAsync(jqG.__elStore.semantic.menusV, jqG.__elStore.semantic.overlays).then(({
							headers,
							footers,
							rootEl,
							rootVisChildren
						}) => {
							jqG.__elStore.semantic.headers = $(headers || []);
							jqG.__elStore.semantic.footers = $(footers || []);
							jqG.__elStore.semantic.rootEl = $(rootEl);
							jqG.__elStore.semantic.rootVisChildren = $(rootVisChildren);
							// forms are sync
							jqG.__elStore.semantic.forms = window._semanticGroupDetectors.findFormGroups(headers, footers); // this is sync; moved here so it stays null untill all others resolve
						});
					}).then(() => {
						const hrds = jqG.__elStore.semantic.headers.toArray();
						return window._semanticGroupDetectors.findLogosAsync(hrds).then(logoElArr => {
							jqG.__elStore.semantic.logos = $(logoElArr);
						});
					}).then(() => {
						return window._semanticGroupDetectors.findMainContentBlockAsync(jqG.__elStore.semantic.footers, jqG.__elStore.semantic.headers, jqG.__elStore.semantic.overlays).then(mainContentElArr => {
							jqG.__elStore.semantic.mainBody = $(mainContentElArr);
						});
					}).then(() => {
						return window._semanticGroupDetectors.findMainTxtChunksAsync(jqG.__elStore.semantic.mainBody, jqG.__elStore.semantic.menus, jqG.__elStore.semantic.overlays, jqG.__elStore.semantic.forms).then(mainTxtChunksArr => {

							jqG.__elStore.semantic.mainTxtChunksArr = mainTxtChunksArr; // NOTE not a jq object
						});
					}).then(() => {
						return window._semanticGroupDetectors.findLoginAndSearchAreaAsync(jqG.__elStore.semantic.socialButtons, jqG.__elStore.semantic.menus, jqG.__elStore.semantic.forms).then(funcAreas => {
							jqG.__elStore.semantic.funcAreas = $(funcAreas);
						});
					}).then(() => {
						// Post-initalization -- we do some adjustments here for other groups -- to avoid circularity
						console.assert(jqG.__elStore.cntrl.computed !== null, "We reached post-initialization before cntrls were initialized -- debug", window.location.href);
						// This is a wonky solution, but I'm too exhausted to do it properly now
						const prArr = ["borderCntrls", "border", "bgColChange", "bgColSetCntrls"].map(jqG.getOtherGrPromise).concat(jqG.getGraphGrPromise("allNonBgBg"));
						// return Promise.all([jqG.getOtherGrPromise("border"), jqG.getOtherGrPromise("bgColChange"), jqG.getOtherGrPromise("bgColSetCntrls"), jqG.getGraphGrPromise("allNonBgBg")])
						return Promise.all(prArr).then(([jqBrdCntrls, jqBrd, jqBgCh, jqBgSetCntrls, jqGr]) => {
							const menus = jqG.__elStore.semantic.menus.toArray();
							// const cmpCntrls = jqG.__elStore.cntrl.computed.toArray();
							var cmpCntrlsStale = jqG.getCntrlGr("computed").toArray();
							const logos = jqG.__elStore.semantic.logos.toArray();
							const txtPrims = jqG.getTxtGr("allNoCntrl").toArray();
							// updating computed controls
							const cmpCntrls = window._filterOutNestedElements(postProcessElCollections(cmpCntrlsStale, logos, menus, jqBrd.add(jqBrdCntrls).toArray(), jqBgCh.add(jqBgSetCntrls).toArray(), txtPrims, jqGr.toArray()).concat(jqG.getCntrlGr("_cmpBtn").toArray()));
							jqG.__elStore.cntrl.computed = $(cmpCntrls);
							// and also the full list of controls
							const _jqAllCntrl = jqG.__elStore.cntrl.real.add(jqG.__elStore.cntrl.computed);
							jqG.__elStore.cntrl.all = $(window._filterOutNestedElements(_jqAllCntrl));
							// txt collections too
							jqG.__elStore.txt.allNoCntrlNoCompCntrl = jqG.__elStore.txt.allNoCntrl.filter((i, el) => {
								return cmpCntrls.every(cmpEl => !cmpEl.contains(el));
							});
							// all primitive colllection
							const _allCntrl = jqG.__elStore.cntrl.all.toArray();
							const _noCmpCntrlGr = jqGr.toArray().filter(grEl => _allCntrl.every(cntrlEl => !cntrlEl.contains(grEl)));
							jqG.__elStore.other.allPrimitives = jqG.getTxtGr("allNoCntrlNoCompCntrl").add(_noCmpCntrlGr).add(_allCntrl); // cmpCntrls can contain text nodes and icons
							// txtOnlyControls - to be used in blackOut
							const _txtNoCntrl = window.domGetters.getTxtGr("allNoCntrl");
							const nonTxtPrimArr = jqG.__elStore.other.allPrimitivesNoCmpCntrl.add(jqG.__elStore.other.iframeAsPrims).not(_txtNoCntrl).toArray();
							jqG.__elStore.other.txtOnlyCntrls = window.domGetters.getCntrlGr("computed").not(window.domGetters.getCntrlGr("_cmpBtn")).filter((i, el)=>{
								return !nonTxtPrimArr.some(nonTxtPrim=>el.contains(nonTxtPrim));
							});
							// moving bottom-win items down the page for screenshotting
							debugger;
							moveFixedBottomsDownPage(jqG.__elStore.semantic.fixedAreas);
						});
					});
				}
			}
			return jqG._semPr.then(() => {
				return jqG.__elStore.semantic[subGrName].filter(() => true);
			}); // Promise.resolve(jqG.__elStore.semantic[subGrName]);
		},
		cleanOverlaysOutAsync: function(containerEl, descElArr) {
			// removes overlays and overlays' visible descendants from descElArr; descElArr are descendants of containerEl
			console.assert(descElArr.every(el => containerEl.contains(el)), "Passed descElArr must be descendants of the containerEl, while they aren't", descElArr.map(el => el.tagName).join(","), window.__el2stringForDiagnostics(containerEl));
			return jqG.getSemanticGrPrms("overlays").then(jqOverlays => {
				const overlayElArr = jqOverlays.toArray().filter(overlEl => !overlEl.contains(containerEl)); // contains also account for containerEl === overlEl
				return descElArr.filter(descEl => {
					// ensuring a descEl is not a descendant of one of overlays -- unless containerEl is an overlay or containerEl is inside some overlays
					return overlayElArr.every(overlEl => !overlEl.contains(descEl)); // every overlEl does NOT contain a descEl
				});
			});
		},
		forceRefresh: function(groupName) {
			// We do graphics separately - they are more complicated and are _measureTextWidthChar_Sync
			graphTypes.forceRefresh();
			// Remove references from the store - they'll be recomputed if we ask for them
			const nullRecursively = (obj) => {
				Object.keys(obj).forEach((key) => {
					if (Object.keys(obj[key]).length) {
						// it's a sub-Object
						return nullRecursively(obj[key]);
					}
					obj[key] = null;
				});
			};
			if (!groupName) {
				return nullRecursively(jqG.__elStore);
			}
			console.assert(jqG.__elStore[groupName], "GroupName", groupName, "isn't in our __elStore");
			// also resetting all promises back to null
			jqG._semPr = null;
			jqG._otherPr = null;
			jqG._graphPr = null;
			return nullRecursively(jqG.__elStore[groupName]);
		}
	};
	
	function moveFixedBottomsDownPage(jqFixedAreas){
		// we'll probably want to avoid having bottom-window sticky items/menus in our screenshots -- let's move such items down the page
		jqFixedAreas.toArray().filter(el=>el._stickyPosition === "bottom").forEach((el, i) => {
			const st = window.getComputedStyle(el);
			if(st["position"] === "fixed"){
				const moveBy = window.getScrlEl().scrollHeight - window.innerHeight;
				const newT = el._origBBox.top + moveBy;
				const newB = (window.innerHeight - el._origBBox.bottom) - moveBy;
				const oldH = window.getScrlEl().scrollHeight;
				window.__enforceCSSVals(el, {top: newT + "px", bottom: newB + "px"});
				console.warn("[ALTER] Moving bottom-window item down the page, newT", newT, ", newB", newB, window.__el2stringForDiagnostics(el));
				if(oldH !== window.getScrlEl().scrollHeight){
					console.error("Page H changed after moving a bottom-window fixed area, oldH: ", oldH, "new H: ", window.getScrlEl().scrollHeight);
				}
			} // if sticky, ignore for now - I'm not sure how to handle them...
		});
	}

	function postProcessElCollections(cmpCntrls, logos, menus, brdEls, bgChEls, txtPrims, grPrims) {
		// Currently only works on cmpCntrls; Uses the late-stage semantic elements to filter early-stage collections of computed controls
		// This is a wonky solution, but I'm too exhausted to do it properly now
		const newCntrls = [];
		cmpCntrls = cmpCntrls.filter(cntrlEl => {
			// a cntrl can't be in or contain logos
			if (logos.some(logoEl => logoEl.contains(cntrlEl) || cntrlEl.contains(logoEl))) {
				return false;
			}
			// a text-only control should either be in a menu, or have brd/bgChange related to it
			const nInCntrlTxtPrims = txtPrims.filter(txtPrim => cntrlEl.contains(txtPrim)).length;
			const nInCntrlGrPrims = grPrims.filter(grPrim => cntrlEl.contains(grPrim)).length;
			if (nInCntrlGrPrims === 0 && nInCntrlTxtPrims > 0) {
				// here it's a text-only cntrl
				// checking if it's in a menu
				if (menus.some(menuEl => menuEl.contains(cntrlEl))) {
					return true;
				}
				// if cntrlEl contains brd/bg el, keep it
				if (brdEls.some(brdEl => cntrlEl.contains(brdEl)) || bgChEls.some(bgEl => cntrlEl.contains(bgEl))) {
					return true;
				}
				// if cntrlEl is contained in a brd/bg el without other primitives + plus size is similar -- replace cntrlEl with the brd/bg element
				const contouringBgEls = __findBgElContouringCntrl(cntrlEl, bgChEls);
				const contouringBrdEls = __findBgElContouringCntrl(cntrlEl, brdEls);
				if (contouringBgEls.length || contouringBrdEls.length) {
					newCntrls.push(...contouringBgEls.concat(contouringBrdEls));
					if (contouringBgEls.length > 1 || contouringBrdEls.length > 1) {
						console.warn("UNUSUAL. More than 1 contouring element found - removing nestedness will take care of it, but debug further", window.__el2stringForDiagnostics(cntrlEl));
					}
					return false; // still false -- we want to exclude the current cntrlEl and use newCntrls instead
				}
				return false;
			}
			return true;
		});
		return window._filterOutNestedElements(cmpCntrls.concat(newCntrls));
	}

	function categorizeIFrames(jqIfr) {
		// some iframes are small and visually resemble a control -- they should be used in cluster.prep.js in distance estimation
		const jqIfrAsPrims = jqIfr.filter((i, el) => {
			const b = el.getBoundingClientRect();
			return b.width * b.height <= MAX_SIZE_IFRAME_AS_PRIMITIVE;
		});
		return {
			jqIfrAsPrims: jqIfrAsPrims,
			jqIfrStandAlone: jqIfr.not(jqIfrAsPrims)
		};
	}

	function __findBgElContouringCntrl(cntrlEl, bgEls, MAX_SIZE_INCREASE = 0.1) {
		return bgEls.filter(bgEl => {
			// check if a bgEl actually contains the controls
			if (!bgEl.contains(cntrlEl)) {
				return false;
			}
			// we could check if the containing bgEl contains other primitives, but I think we can skip it -- just check if the size grows dramatically - if yes, exclude; if no, keep
			const bgBBox = window._getFloatProofBBox(bgEl);

			const cntrlBBox = window._getFloatProofBBox(cntrlEl);
			// const bgBBox = bgEl.getBoundingClientRect();
			// const cntrlBBox = cntrlEl.getBoundingClientRect();
			return bgBBox.width <= cntrlBBox.width * (1 + MAX_SIZE_INCREASE) && bgBBox.height <= cntrlBBox.height * (1 + MAX_SIZE_INCREASE);
		});
	}

	function getElsWithBgSetPromise(jqCntrl) {
		const jqCntrlAndDesc = jqCntrl.find(":visible").add(jqCntrl);
		// some bgCol elements are masked as having "gradient" in their bg-img -- take them
		const gradientBgEls = jqG.getAllVis().filter((i, el) => {
			const st = window.getComputedStyle(el);
			return st["background-image"] !== "none" && st["background-image"].indexOf("url(") === -1;
		}).toArray();
		return Promise.all(gradientBgEls.map(el => window.getBgColorAsync(el))).then(bgColArr => {
			console.assert(bgColArr.length === gradientBgEls.length, "N of gradient bg elements !== N of getBgColorAsync results", bgColArr.length, gradientBgEls.length, window.location.href);
			gradientBgEls.forEach((el, i) => { // recording computed bgCol
				el.__bgRGBcol = bgColArr[i];
			});
			return graphObjStore.requestCatGraphObjArr();
		}).then(_graphObjArr => {
			const imgBgBg = _graphObjArr.filter(x => x.type === graphTypes.bgBg).map(x => {
				x.el.__bgRGBcol = window.__calAvgRGBa(x.cnvs.getContext("2d").getImageData(0, 0, x.cnvs.width, x.cnvs.height).data);
				if (x.el.__bgRGBcol[3]) {
					// adjust Alpha so it's in [0, 1] instead of [0, 255]
					x.el.__bgRGBcol[3] /= 255;
				}
				return x;
			}).map(x => x.el);
			const allGraphArr = _graphObjArr.map(x=>x.el); // Filtering these out -- Because bgImg overwrites bgCol, and we shouldn't count such cases as BG elements
			const jqBgSet = jqG.getAllVis().filter((i, el) => {
				const st = window.getComputedStyle(el);
				const rgbBr = window._cssCol2RgbaArr(st["background-color"]);
				// const bgImgSet = st["background-image"].indexOf("url(") > -1; // because bgImg overwrites bgCol
				el.__bgRGBcol = rgbBr;
				return rgbBr[3] === undefined || rgbBr[3] >= MIN_VISIBLE_OPACITY;
			}).not(allGraphArr).add(imgBgBg).add(gradientBgEls);
			// only gets elements with background being set and different from the outside
			const jqBgDif = jqBgSet.filter((i, el) => {
				const st = window.getComputedStyle(el);
				const bbox = window._getAbsBoundingRectAdjForParentOverflow(el, true);
				const midY = Math.round((bbox.top + bbox.bottom) / 2);
				const midX = Math.round((bbox.left + bbox.right) / 2);
				if (el.__bgRGBcol[3] !== undefined && el.__bgRGBcol[3] < (1 - MIN_VISIBLE_OPACITY)) {
					// re-take the color with screenshotting -- we don't know what color is underneath those elements
					const insidePixelXYs = [{
						x: midX,
						y: bbox.top + parseInt(st["borderTopWidth"]) + 1
					},
					{
						x: midX,
						y: bbox.bottom - parseInt(st["borderBottomWidth"]) - 1
					},
					{
						x: bbox.left + parseInt(st["borderLeftWidth"]) + 1,
						y: midY
					},
					{
						x: bbox.right - parseInt(st["borderRightWidth"]) - 1,
						y: midY
					}]; // 4 pixels is hopefully enough to account for gradients
					if (insidePixelXYs[0].y >= bbox.bottom || insidePixelXYs[2].x >= bbox.right) {
						console.error("The element is too thin -- we didn't have a pixel to sample, bbox:", bbox, "insidePixelXYs", insidePixelXYs, window.location.href);
						return false;
					}
					// NOTE: We hide the insides of the element before we sample a pixel
					const aCnvs = _el2canvasNoOverlays(el, window.getFullPageBBox(), true, null, false);
					// const aCnvs = window.getStoredFullPageCanvas();
					el.__bgRGBcol = window._avgRgbArr(window.getRgbAtPoints(aCnvs, insidePixelXYs));
				} else {
					// we still need to transform the alpha channel to [0, 255]
					// console.log("Fuk you fucking debugger;");
					el.__bgRGBcol = window.__alpha2uint(el.__bgRGBcol);
				}
				// take a few pixels outside the bbox
				// const outsidePixelXYs = [{x: midX, y: bbox.top-2}, {x: midX, y: bbox.bottom+2}, {x: bbox.left-2, y: midY}, , {x: bbox.right+2, y: midY}].filter(__filterOutsideWindowCoords);
				const outsidePixelXYs = __sampleOutsidePixelXYs(bbox, N_PIX_2_SAMPLE_FOR_BG);
				if (!outsidePixelXYs.length) {
					console.log("None of our 'outside' pixels for bg comparison where within a window ==> presuming it's a full-body element and not taking it");
					return false;
				}
				const outsidePixelRgb = window.getRgbAtPoints(window.getStoredFullPageCanvas(), outsidePixelXYs);
				return outsidePixelRgb.filter(outsideRgb => __are2colorsDiff(outsideRgb, el.__bgRGBcol)).length >= outsidePixelXYs.length / 3; // at least a third of pixels are of different color
			});
			return Promise.resolve({
				jqBgSet: jqBgSet.not(jqCntrlAndDesc),
				jqBgDif: jqBgDif.not(jqCntrlAndDesc),
				jqBgSetCntrls: jqBgSet.filter(jqCntrlAndDesc)
			});
		});
	}

	function __assignHidPropsToGrEls(grEl) {
		if (grEl.b === undefined) {
			debugger;
		}
		grEl.el._bbox = grEl.b;
		grEl.el._gType = grEl.type;
		return grEl.el;
	}

	function __sampleOutsidePixelXYs(bbox, nPerSide = 5) {
		// to be used getElsWithBgSetPromise -- we need more than 4 pixels, otherwise we risk to accidentally detect color at, e.g., a) a thick border, b) content/text, c) image
		// [{x: midX, y: bbox.top-2}, {x: midX, y: bbox.bottom+2}, {x: bbox.left-2, y: midY}, , {x: bbox.right+2, y: midY}]
		const pixels = __sampleOutsidePixelXYsFor1Side(bbox, nPerSide, "x", "start").concat(__sampleOutsidePixelXYsFor1Side(bbox, nPerSide, "x", "end"), __sampleOutsidePixelXYsFor1Side(bbox, nPerSide, "y", "start"), __sampleOutsidePixelXYsFor1Side(bbox, nPerSide, "y", "end"));
		return pixels.filter(__filterOutsideWindowCoords);
	}

	function __sampleOutsidePixelXYsFor1Side(bbox, nPerSide = 5, bboxSide = "x", startEnd = "start") {
		console.assert(bboxSide === "y" || bboxSide === "x", "Only vert/horz values are allowed for pixel sampling from a bbox", window.location.href);
		const _size = (bboxSide === "x") ? bbox.width : bbox.height;
		const MIN_STEP_SIZE = 5;
		if (_size < nPerSide * MIN_STEP_SIZE) {
			nPerSide = Math.max(1, Math.floor(_size / MIN_STEP_SIZE));
			console.warn("Reducing the nPerSide pixels to sample down to ", nPerSide, window.location.href);
		}
		var step = (bboxSide === "x") ? (bbox.width) / nPerSide : (bbox.height) / nPerSide;
		const startCoord = ((bboxSide === "x") ? bbox.left : bbox.top) - step / 2;
		const thisCoord = (new Array(nPerSide)).fill().map((el, i) => {
			return startCoord + (i + 1) * step;
		});
		const otherCoord = (startEnd === "start") ? (bboxSide === "x") ? [bbox.top - 2, bbox.top - 5] : [bbox.left - 2, bbox.left - 5] : (bboxSide === "x") ? [bbox.bottom + 2, bbox.bottom + 5] : [bbox.right + 2, bbox.right + 5];
		const xyArr = thisCoord.map(c1 => {
			return otherCoord.map(c2 => {
				return (bboxSide === "x") ? {
					x: c1,
					y: c2
				} : {
					y: c1,
					x: c2
				};
			});
		}).reduce((a, x) => a.concat(x)).map(cObj => {
			cObj.x = Math.round(cObj.x);
			cObj.y = Math.round(cObj.y);
			return cObj;
		});
		return xyArr;
	}

	function __filterOutsideWindowCoords({
		x,
		y
	}) {
		return x >= 0 && x < window.__getSaneDocScrollWidth() && y >= 0 && y < window.getScrlEl().scrollHeight;
		// return x >= 0 && x < window.getScrlEl().scrollWidth && y >= 0 && y < window.getScrlEl().scrollHeight;
	}

	function getElementWithBorder(jqCntrl) {
		// -z - exclude Controls and their internals -- they often have border, but should be viewed as their own thing <== Or should they?... 
		const jqCntrlAndDesc = jqCntrl.find(":visible").add(jqCntrl);
		const jqBrdSet = jqG.getAllVis().filter((i, el) => {
			const st = window.getComputedStyle(el);
			var elBbox, elAdjBBox;
			// a - has border <-- border width also addresses borderStyle:hidden and none
			const presentBorders = ["borderBottomWidth", "borderRightWidth", "borderLeftWidth", "borderTopWidth"].filter(brdName => {
				const brdW = parseInt(st[brdName]);
				console.assert(!isNaN(brdW), "Not an integer border width -- is it even possible?:", st[brdName], window.location.html);
				if (brdW <= 0) {
					return false; // to avoid calculations below
				}
				// b - color non-transp <-- We have to do it here, because otherwise the default colorVal has no alpha channel, and we'd think it's visible, while it might not
				const rgba = window._cssCol2RgbaArr(st[brdName.replace("Width", "Color")]);
				if (rgba[3] !== undefined && rgba[3] < MIN_VISIBLE_OPACITY) {
					return false; // transparent borders aren't visible
				}
				// c - the border isn't made invisble by overflow
				if (!elBbox) {
					elAdjBBox = window._getAbsBoundingRectAdjForParentOverflow(el);
					elBbox = el.getBoundingClientRect(); //native version -- empty element have no border visible, so all is fair
				}
				const brdLoc = brdName.replace("border", "").replace("Width", "").toLowerCase();
				if (Math.abs(elAdjBBox[brdLoc] - elBbox[brdLoc]) >= 1) {
					return false; // OPTIMIZE: do >= brdW and accounting for a possible 'thinning' of the border
				}
				// d - border color diff from bgCol <-- we have to extract it again from a screenshot -- to avoid accounting for alphaChannel, underlying colors, etc. <== we can't do this for border, because dashed/dotted/etc.
				// recording the color for saving it later on -- without recalculating it
				if (el.__brdCol === undefined) {
					el.__brdCol = {};
				}
				const dirctn = brdName.replace("border", "").replace("Width", "").toLowerCase() + "CmpBrdCol";
				// d.2 - Check if bgCol or bgImg are set
				// FIXME: check if background-image is monochrome and matches border color
				// FIXME: check for background-image transparency
				if (st["background-image"].indexOf("url(") > -1) {
					el.__brdCol[dirctn] = rgba.join("_");
					return true;
				}
				const bgColRgba = window._cssCol2RgbaArr(st["background-color"]);
				if (bgColRgba[3] === 1) { // if bgCol is completely not transparent
					const noAlphaRgba = window.combineCssColorWithBgColor(rgba, bgColRgba);
					el.__brdCol[dirctn] = noAlphaRgba.join("_");
					// FIXME: replace !== 0 with MIN_VISIBLE_OPACITY
					return __are2colorsDiff(bgColRgba, noAlphaRgba);
				}
				//  d.3 - Element Bg is (partially) transparent ==> Sample a pixel from the inside of the element
				var sampleX, sampleY;
				if (brdLoc === "bottom" || brdLoc === "top") {
					sampleX = Math.round((elAdjBBox.left + elAdjBBox.right) / 2); // we'll take the middle - otherwise borderRadius may mess with it
					sampleY = Math.round((brdLoc === "bottom") ? (elAdjBBox.bottom - brdW - 1) : (elAdjBBox.top + brdW + 1));
					if (brdW * 2 >= elAdjBBox.height) { //checking if element has no insides -- it's border only
						return true; // FIXME: use actual border widths instead of *2
					}
				} else if (brdLoc === "left" || brdLoc === "right") {
					sampleY = Math.round((elAdjBBox.bottom + elAdjBBox.top) / 2); // we'll take the middle - otherwise borderRadius may mess with it
					sampleX = Math.round((brdLoc === "left") ? (elAdjBBox.left + brdW + 1) : (elAdjBBox.right - brdW - 1));
					if (brdW * 2 >= elAdjBBox.width) { //horizontal: checking if element has no insides -- it's border only
						return true; // FIXME: use actual border widths instead of *2
					}
				} else {
					console.error("We can't be here. Which border is it?, ", brdLoc);
				}
				const insCoords = [{
					x: sampleX,
					y: sampleY
				}].filter(__filterOutsideWindowCoords);
				if (!insCoords.length) {
					console.error("the pixel is outside window - not sure how this is possible --> discounting this element from border estimation", window.location.href);
					debugger;
					return false;
				}
				const insidePixelRgba = window.getRgbAtPoints(window.getStoredFullPageCanvas(), insCoords)[0];
				const noAlphaRgba = window.combineCssColorWithBgColor(rgba, insidePixelRgba);
				el.__brdCol[dirctn] = noAlphaRgba.join("_");
				return __are2colorsDiff(insidePixelRgba, noAlphaRgba);
			});
			el.__presentBorders = presentBorders.map(brdName => brdName.replace("border", "").replace("Width", "").toLowerCase());
			return el.__presentBorders.length;
		});
		return {jqBrdSet: jqBrdSet.not(jqCntrlAndDesc), jqBrdCntrls: jqBrdSet.filter(jqCntrlAndDesc)};
	}

	function __are2colorsDiff(col1Rgba, col2Rgba) {
		const rgb1 = window._rgba2rgb(col1Rgba);
		const rgb2 = window._rgba2rgb(col2Rgba);
		return [0, 1, 2].reduce((diff, i) => {
			return diff += Math.abs(rgb1[i] - rgb2[i]);
		}, 0) > MIN_VISIBLE_COL_DIFF_TO_COUNT;
	}

	function detectNonNativeNonCompoundControls(jqAllVis, jqRealCntrl) {
		// -1 - Filter out actual controls
		var jqCntrl = jqAllVis.not(jqRealCntrl);
		// -0.9 - Omit top-level items and iframes
		jqCntrl = jqCntrl.not("html, body, iframe", "form", "label");
		// 0 - Controls can't/unlikely be inside some Elements, e.g., an <a> in a <p> or <h> aren't controls
		jqCntrl = __filterElements(jqCntrl, _tagSets.controlsCantBeIn, true);
		// 1 - DETECTION: 
		// 1.1 - cursor changed <-- clear indicator for non <a>
		const cursorsControlsMayHave = ["context-menu", "help", "pointer", "crosshair", "copy", "move", "grab", "all-scroll"];
		const jqCntrlCursor = jqCntrl.filter((i, el) => {
			const elCursor = window.getComputedStyle(el).cursor;
			return cursorsControlsMayHave.includes(elCursor);
		});
		// 1.2 - DETECTION: has hover
		const jqCntrlHover = window.findElsStyledOnHover(jqCntrl.not(jqCntrlCursor));
		// 1.3 - <a> that slipped out of the filter above (maybe devs disabled cursor change etc.)
		// const jqCntrlA = jqCntrl.filter("a");
		const cntlAEls = jqCntrl.filter("a").toArray();
		// 1.4 - Combine all
		jqCntrl = jqCntrlCursor.add(jqCntrlHover).add(cntlAEls).filter((i, el) => {
			// Cntrls can't be nested in links
			return cntlAEls.every(aEl => aEl.isSameNode(el) || !aEl.contains(el));
		});
		// NOTE: I can't do much beyond cursor -- EventHandlers are often assigned/triggered for the Parent, not an element itself
		// 2 - FILTER
		// 2.0 - only small images are allowed inside
		// NOTE: we can't use our icon collection here -- it doesn't exist at this stage --> use a cheaper semi-solution; Ignoring bg images for now
		const allVisElsAsArr = jqAllVis.toArray();
		jqCntrl = jqCntrl.filter((i, el) => {
			return Array.from(el.children).filter(subEl=>{
				// ensuring only visible children are considered
				return allVisElsAsArr.includes(subEl);
			}).concat([el]).every(subEl=>{
				// ignoring non-images
				if(!_tagSets.media.has(subEl.tagName.toLowerCase())){
					return true;
				}
				// only accepting icons and UI
				const bbox = window._getFloatProofBBox(subEl);
				const isThisRealImg = true; // because we filter down to _tagSets.media
				return __isItUI(bbox, isThisRealImg) || __isItIcon(bbox, isThisRealImg);
			});
		});		
		// 2.1 - not large;
		jqCntrl = jqCntrl.filter((i, el) => {
			// const bbox = el.getBoundingClientRect();
			const bbox = window._getFloatProofBBox(el);
			return Math.max(bbox.height, bbox.width) < MAX_CONTROL_MAX_DIM && Math.min(bbox.height, bbox.width) < MAX_CONTROL_MIN_DIM;
		});
		// 2.2 - Only a single text node is allowed; [I DON"T check for this yet ==>] and only a single icon/ui graphical element
		jqCntrl = jqCntrl.filter((i, el) => {
			// 2.2.1 - Get all 'real' inside nodes 
			// NOTE: unfortunately, this also finds invisible text nodes, e.g., those with giant text-indent to move it off screen
			const txtNodesArr = $(el)
				.find("*")
				.add(el)
				.toArray()
				.filter(el=>allVisElsAsArr.includes(el))
				.map(el=>Array.from(el.childNodes).filter(subEl=>subEl.nodeType === document.TEXT_NODE))
				.flat()
				.filter(el => {
					// checking length, so we avoid counting whitespace nodes, and single-character items (which are often icons)
					return el.nodeValue.trim().length > 1; // > 1 because we don't want to count glyphs towards textNode limits
				}); 
			return txtNodesArr.length <= MAX_CONTROL_TXT_NODES;
		});
		// 2.3 - single line of text
		jqCntrl = jqCntrl.filter((i, el) => {
			return __isItOneLineTxtEl(el);
		});
		// // 3 - in-text links shouldn't be counted as controls --> no text-only immediate siblings, unless there is an <a> sibling
		// const jqCntrlTMP = jqCntrl.filter((i, el) => {
		// 	// 3.1 - Find all controls (from jqCntrl and jqRealCntrl) within the parent of a target control
		// 	const pEl = el.parentNode;
		// 	// OPTIMIZE: some descendands will be matched many timeouts
		// 	const elSiblCntrlArr = jqCntrl.not(pEl).add(jqRealCntrl).filter((i, el) => {
		// 		return pEl.contains(el);
		// 	}).toArray();
		// 	// 3.2 - Remove nestedness; and Get all potential control text and count its length
		// 	const cntrlTxt = window._filterOutNestedElements(elSiblCntrlArr).map(el => window._getVisInnerTxt(el) || "").join("");
		// 	// 3.3 - If control text > say 90% of all Parent's text, these are controls
		// 	const pTxt = _getVisInnerTxt(pEl); // NOTE: for some elements (e.g., SVG) innerText is undefined
		// 	console.assert(pTxt.length - cntrlTxt.length >= 0, "Descendant controls contain more text than their parent? Not possible, pEl:", pEl, "pTxt:", pTxt, "cntrlTxt:", cntrlTxt);
		// 	return (1 - MAX_NON_CONTROL_TXT_IN_PARENT) * pTxt.length <= cntrlTxt.length;
		// });
		// 3 - in-text links shouldn't be counted as controls --> no text-only immediate siblings, unless there is an <a> sibling
		const jqCntrlTMP = jqCntrl.filter((i, el) => {
			// 3.0 - If "el" is itself a block-level item, just keep it
			if(__isItBlock(el)){
				return true;
			}
			// 3.1 - Get a block-level parent
			const pEl = __findBlockAncestor(el);
			// 3.2 - Filter out nested block-level elements
			const nestedBlockItems = $(pEl).find(":visible").filter((i, el)=>__isItBlock(el)).toArray();
			// 3.1 - Find all controls (from jqCntrl and jqRealCntrl) within the parent of a target control
			// OPTIMIZE: some descendands will be matched many timeouts
			const elSiblCntrlArr = jqCntrl.not(pEl).add(jqRealCntrl).filter((i, el) => {
				return pEl.contains(el) && nestedBlockItems.every(blockEl=>!blockEl.contains(el)); // avoiding block-level intermediary ancestors - no point counting them
			}).add(el).toArray();
			// 3.2 - Remove nestedness; and Get all potential control text and count its length
			const cntrlTxt = window._filterOutNestedElements(elSiblCntrlArr).map(el => window._getVisInnerTxt(el) || "").map(str=>str.trim()).join("");
			// 3.3 - Get non-control, non-block texts
			const otherTxtNodes = $(pEl).find(":visible").add(pEl).contents().filter((i, el)=>{
				return el.nodeType === document.TEXT_NODE && allVisElsAsArr.some(visEl=>visEl.isSameNode(el.parentElement)); // filter out inivisble text nodes
			}).filter((i, el)=>{
				return elSiblCntrlArr.every(cntrlEl=>!cntrlEl.contains(el)) && nestedBlockItems.every(blockEl=>!blockEl.contains(el));
			}).toArray();
			// 3.4 - Sum that text
			const pTxt = otherTxtNodes.map(txtNode=>_getVisInnerTxt(txtNode.parentElement) || "").map(str=>str.trim()).join("");
			return pTxt.length <= MAX_NON_CONTROL_TXT_IN_PARENT * cntrlTxt.length;
			// // 3.3 - If control text > say 90% of all Parent's text, these are controls
			// const pTxt = _getVisInnerTxt(pEl); // NOTE: for some elements (e.g., SVG) innerText is undefined
			// console.assert(pTxt.length - cntrlTxt.length >= 0, "Descendant controls contain more text than their parent? Not possible, pEl:", pEl, "pTxt:", pTxt, "cntrlTxt:", cntrlTxt);
			// return (1 - MAX_NON_CONTROL_TXT_IN_PARENT) * pTxt.length <= cntrlTxt.length;
		});
		//[MAYBE LATER] 4 - an <a> with an icon/ui is always a control (still check for the text being short)
		// 5 - Remove nestedness <-- I should have an F somewhere
		return window._filterOutNestedElements(jqCntrlTMP);
	}
	
	function __findBlockAncestor(el){
		// NOTE: el should be below <body>
		var pEl = el;
		while((pEl = pEl.parentElement) !== null){
			if(__isItBlock(pEl)){
				return pEl;
			}
		}
		console.error("We've looked up all the way to HTML and found no block-level parent, returning immediate parent instead.", window.__el2stringForDiagnostics(el));
		return el.parentElement;
	}
	
	const __isItBlock = (()=>{
		const blockCssVals = ["block", "flex", "grid", "flow-root", "block flow", "block flex", "block flow-root", "block grid"];
		return (el)=>{
			const st = window.getComputedStyle(el);
			return blockCssVals.some(x=>x===st["display"]);
		};
	})();

	function __isItOneLineTxtEl(anEl) {
		if ($(anEl).find("br").length) {
			return false; // no line breaks allowed, obviously
		}
		const origBbox = window._getFloatProofBBox(anEl);
		// const origBbox = anEl.getBoundingClientRect();
		window.__setTxtRecurs(anEl, LETTER_TO_CHECK_SINGLE_LINENESS);
		const newBbox = window._getFloatProofBBox(anEl);
		// const newBbox = anEl.getBoundingClientRect();
		window.__restoreTxtRecurs(anEl);
		const hChange = Math.abs(origBbox.height - newBbox.height);
		const wChange = Math.abs(origBbox.width - newBbox.width); // just in case it was a vertical button
		const dimChange = Math.min(hChange, wChange);
		return dimChange < 2; // allow for 2 pixels of change
	}

	function __filterElements(jqEls, elNamesSet, ifInverse = false) {
		//filters down to those that are in the tagSet or descendants of els in tagSet
		const ___checkConditionRecursively = function(element) {

			var res = false;
			if (element.tagName.toLowerCase() !== "html") {
				res = elNamesSet.has(element.tagName.toLowerCase());
				if (!res) {

					if (element.parentNode) {
						res = ___checkConditionRecursively(element.parentNode);
					} else {
						console.log("PARENT NODE IS empty: ", element.tagName);
					}
				}
			}
			return res;
		};
		return jqEls.filter(function() {
			var takeit = ___checkConditionRecursively(this);
			if (ifInverse) {
				takeit = !takeit;
			}
			return takeit;
		});
	}

	function __filterElementsNoParentMatch(jqEls, tagSet, ifInverse = false) {
		// filters down to exact matches to tagSet
		return jqEls.filter((i, el) => {
			let keepit = tagSet.has(el.tagName.toLowerCase());
			if (ifInverse) {
				return !keepit;
			}
			return keepit;
		});
	}

	function _categorizeGraphicsNew(jqAllVis) {
		debugger;
		const __markZeroSize = (elObjArr, ifBg = false) => elObjArr.forEach(elObj => {
			if (elObj.b.height < 1 || elObj.b.width < 1) {
				console.warn("A (near) zero-sized bounding box after adjusting for parent overflow: ", JSON.stringify(elObj.b), window.location.href);
				elObj.type = ifBg ? graphTypes.bgZero : graphTypes.zero;
			}
		});
		const jqAllGraph = __filterElementsNoParentMatch(jqAllVis, _tagSets.media, false);
		// 0 - Add graphical pseudo elements
		const jqPseudoGraph = _detectPseudoElIcons(jqAllVis);
		// 0.1 - [NEW] Add main graphics extracted from pseudo elements <-- I keep them in clean spans
		// NOTE: let's hope we never encounter actual elements with "content"
		const jqRest = __filterElementsNoParentMatch(jqAllVis, _tagSets.media, true);
		const jqContentImg = jqRest.filter((i, el)=>{
			return el.__pseudoHasImg === true || window.getComputedStyle(el)["content"].indexOf("url(") > -1;
		});
		// const jqNativeContentImg = jqRest.filter((i, el)=>{
		// 	// Detecting cases of "content: url..." on divs etc.
		// 	return el.__pseudoHasImg !== true && window.getComputedStyle(el)["content"].indexOf("url(") > -1;
		// });
		jqContentImg.toArray().forEach(el => {
			if(!el.classList.contains("__clean-span")){
				console.log("%c[UNUSUAL] Found an element with image content -- not our span.__clean-span with an extracted pseudo element image." + window.__el2stringForDiagnostics(el), "color:red;");
				debugger;
			}
		});
		// 1 - Categorize non-bg graphic
		const allGraphRes = jqAllGraph.add(jqPseudoGraph).add(jqContentImg).toArray().map(el => {
			var b = window._getAbsBoundingRectAdjForParentOverflow(el);
			var noAdjB = el.getBoundingClientRect();
			if (el.__pseudoType !== undefined) {
				// we should set letterSpacing and lineHeight to defaults -- so we get a correct bbox; because glyphs are affected by text features/properties, and so are their bboxes
				window.__setCSSPropJqArr([el], "line-height", "1", "important");
				window.__setCSSPropJqArr([el], "letter-spacing", "0", "important");
				b = window._getAbsBoundingRectAdjForParentOverflow(el);
				noAdjB = el.getBoundingClientRect();
				window.__restoreCSSPropJqArr([el], "line-height");
				window.__restoreCSSPropJqArr([el], "letter-spacing");
			}
			var type;
			if (el.__pseudoType === "glyph") {
				// type = graphTypes.icon;
				type = graphTypes.glyph;
				// NOTE: if el.__pseudoType === "img", we still need to test it -- it may be a large image
			} else {
				const isItRealImg = el.__pseudoType === undefined;
				// NOTE: non-adjested BBox should be used in estimating gr type -- we often have truncated main images
				type = __isItUI(noAdjB, isItRealImg) ? graphTypes.ui : __isItIcon(noAdjB, isItRealImg) ? graphTypes.icon : graphTypes.main;
			}
			return {
				b: b,
				type: type,
				el: el,
				noAdjB: noAdjB
			};
		});
		// 1.1 - Mark near zeros as such - we should worry about them, as they are close to invisible
		__markZeroSize(allGraphRes, false);
		// allGraphRes.forEach((item, i) => {
		// 	console.assert(window._getAbsBoundingRectAdjForParentOverflow(item.el).left === item.b.left, "not equal for", window.__el2stringForDiagnostics(item.el));
		// });
		// 2 - Background graphics - if they are images, we'll replace them differently
		const jqBackImgAll = jqRest.filter((i, el)=> {
			return (window.getComputedStyle(el)["background-image"].toLowerCase().indexOf("url") !== -1);
		});
		return window._getOnlyBgImgSizesAsync(jqBackImgAll).then(bgImgLoadRes => {
			// filter out non-loaded images
			console.log("Got all bg Images that loaded");
			const allBgRes = bgImgLoadRes.filter(loadRes => loadRes.loaded).map(loadRes => {
				const el = loadRes.el;
				const b = window._getAbsBoundingRectAdjForParentOverflow(el);
				const noAdjB = el.getBoundingClientRect();
				// TODO: adjust for no-repeat and bg-size/position ==> check if the background image is repeated - if not, reduce the box down to Min(icon size, element size) <== _getNonRepeatedBgImgSize
				const type = __isItUI(noAdjB, false) ? graphTypes.bgUi : graphTypes.bgBg;
				return Object.assign(loadRes, {
					b: b,
					type: type,
					noAdjB: noAdjB
				});
			});
			__markZeroSize(allBgRes, true);
			// 3 - Keep canvases for all non-zero graphical elements
			// 3.1 - We should detach visible Overlays from DOM when screenshotting Backgrounds - otherwise we often have sticky elements in them
			const outCatGraphArr = allGraphRes.concat(allBgRes);
			// const _jqOverlays = _findActualOverlays(outCatGraphArr.filter(x=>x.type !== graphTypes.bgBg).map(x => x.el));
			const _jqOverlays = _findAllPositionedEls(); // NOT JUST overlays; all positioned items need to be removed when screenshotting
			return outCatGraphArr.reduce((p, graphObj) => {
				return p.then(() => {
					if (graphObj.type.indexOf("zero") > -1) {
						// do nothing for these tiny elements
						return Promise.resolve();
					}
					// else obtain a canvas
					return __cnvsOneByOne(graphObj, _jqOverlays).then(graphObj => {
						// and maybe even finish BG categorizations
						if (graphTypes.isItBg(graphObj.type)) {
							__finishUpdatingBgType(graphObj);
						}
					});
				});
			}, Promise.resolve()).then(() => {
				console.log("GOT all graphics");
				return outCatGraphArr;
			});
		});
	}

	function __finishUpdatingBgType(graphObj) {
		if (graphObj.type !== graphTypes.bgUi) { // we shouldn't check SD for UI -- it may not have more than 1 pixel!
			const cnvs = graphObj.cnvs;
			var bgCoversEl = false; // an extra check if a bg is not replicated -- cause it is "repeated" by default, even if an image is large
			if (graphObj.nativeHeight !== undefined) {
				// replicated bg images may have a large SD -- avoiding misclassifying those
				const nativeImgSize = graphObj.nativeHeight * graphObj.nativeWidth;
				const bSize = graphObj.noAdjB.width * graphObj.noAdjB.height;
				if (nativeImgSize < MAX_BG_IMG_NATIVE_SIZE && bSize > nativeImgSize * 5) { // *5 is chosen randomly
					// FIXME: have a more robust bg-replication detection instead of "bSize > nativeImgSize * 5"; e.g., via background-replicate CSS
					console.log("Small-size bg image detected -- kept as bg, size:", graphObj.nativeHeight * graphObj.nativeWidth);
					graphObj.type = graphTypes.bgBg;
					return;
				}else if(nativeImgSize > bSize * MIN_RATIO_BG2EL_NONREPEAT_BG){
					bgCoversEl = true;
				}
			}
			// additional categorization - non-picture/monochrome backgrounds
			const anSd = window.__calcSD(cnvs.getContext("2d").getImageData(0, 0, cnvs.width, cnvs.height).data);
			const thr = (!bgCoversEl && __isBgRepeated(graphObj.el))?MAX_SD_NONPIC_BG_WHEN_REPL:MAX_SD_NONPIC_BG;
			if (anSd <= thr) {
				console.log("Non-picture bg detected and kept as bg, sd:", anSd, window.__el2stringForDiagnostics(graphObj.el));
				graphObj.type = graphTypes.bgBg; // we keep it as the true background
			} else {
				// too much variance for it to be a uniform background -- it's a graphical element 
				graphObj.type = __isItIcon(graphObj.noAdjB, false) ? graphTypes.bgIcon : graphTypes.bgMain;
			}
		}
	}
	
	function __isBgRepeated(bgEl){
		const st = window.getComputedStyle(bgEl);
		return st["background-repeat"] !== "no-repeat" && st["background-repeat"] !== "no-repeat no-repeat";
	}

	function __cnvsOneByOne(graphObj, _jqOverlays) {
		console.assert(graphObj.b.height >= 1 && graphObj.b.width >= 1, "We should not screenshot/canvas tiny elements - they should be counted but, ignored");
		const b = graphObj.b;
		const ifBgEl = graphTypes.isItBg(graphObj.type);
		return window._el2canvasWhiteBgNoOverlaysAsync(graphObj.el, b, ifBgEl, _jqOverlays).then(cnvs => {
			graphObj.cnvs = cnvs;
			return graphObj;
		});
	};

	const __isTxtNodeZeroSize = (function() {
		// to be used in __wrapTextNodesInSpans <-- because inline-block elements respect whitespace and get separated by it; we need to preserve this white space
		const range = document.createRange();
		const nonBrSpaceUniRegEx = /[\u202f\u2007\u2060\u00a0\ufeff]/;
		return (txtNode) => {
			range.selectNode(txtNode);
			const bbox = range.getBoundingClientRect();
			// NEW: for some reason zero-sized nonBreakingSpace Unicode characters participate in layout drawing -- we'll have to keep them
			return bbox.width * bbox.height === 0 && !nonBrSpaceUniRegEx.test(txtNode.nodeValue);
		};
	})();

	const {
		__wrapTextNodesInSpans,
		__unwrapTextNodesFromSpans
	} = (function() {
		const changesStore = [];
		const cssInjctr = new window.CssInjector();
		// const allStKeys = [... window.getComputedStyle(document.documentElement)];
		function ___revertStyleChanges(el, oldStObj, oldStObjPseudo) {
			// window.injectCss
			// debugger;
			const newStObj = window.getComputedStyle(el);
			// find what's changed about an element
			const changedStyles = window.__getAllCssPropList().filter(st => newStObj[st] !== oldStObj[st]);
			if (changedStyles.length) {
				const stObj2Enforce = Object.fromEntries(changedStyles.map(st => [st, oldStObj[st]]));
				window.__enforceCSSVals(el, stObj2Enforce);
			}
			// repeat the same for pseudo elements
			Object.entries(oldStObjPseudo).map(([pseudoKey, stObj]) => {
				const pStObj = window.getComputedStyle(el, pseudoKey);
				const psChangedStyles = window.__getAllCssPropList().filter(st => pStObj[st] !== stObj[st]);
				if (psChangedStyles.length) {
					const psStObj2Enforce = Object.fromEntries(psChangedStyles.map(st => [st, stObj[st]]));
					cssInjctr._injectCss1Element(el, pseudoKey, psStObj2Enforce);
					// // we can't use the style prop --> creating a css rule instead
					// if(!el.id || !el.id.length){
					// 	el.id = window._generateId();
					// }
					// cssInjctr._injectCss("#"+el.id+pseudoKey, psStObj2Enforce);
				}
			});
		}
		function* ___alAncestorsInArr(el){
			yield el.tagName.toLowerCase();
			while((el = el.parentElement) !== null){
				yield el.tagName.toLowerCase();
			}
		}
		function ___checkIfWhSpaceShouldBeAlwaysKept(aControlEl){
			// checking if whiteSpace should be not removed -- Using a blanket approach instead of specific ones for each "white-space" value because it's a bit too many conditions/exceptions/gray areas
			// 1 - Check if it's wrapped in <pre>
			const ifItsInPre = Array.from(___alAncestorsInArr(aControlEl)).find(x=>x === "pre") !== undefined;
			// 2 - Check element's white-space CSS
			const st = window.getComputedStyle(aControlEl);
			const ifCssPreSet = st["white-space"] !== "normal" && st["white-space"] !== "nowrap";
			return ifItsInPre || ifCssPreSet;
		}
		return {
			// NOTE: I may have to save all computed styles before any changes -- technically not just siblings can affect rules -- see if this comes up in practice
			__wrapTextNodesInSpans: function(aControlEl) {
				// ATTENTION: This permanently modifies the original HTML - Only inteded for invisible text to stay undetected, e.g., in folded <details>
				// We're saving a reference to the original non-text nodes in aControlEl, so we can check for any style changes to them due to DOM alteration
				const nonTxtChildEls = Array.from(aControlEl.childNodes).filter(el => el.nodeType === document.ELEMENT_NODE);
				const nonTxtChildElStyles = nonTxtChildEls.map(el => window.__cssValsToObj(window.getComputedStyle(el), window.__getAllCssPropList())); // We copy styles in a non-live object, so they don't change with an element
				// also copy styles for pseudoElements
				const nonTxtChildElPseudoStyles = nonTxtChildEls.map(el => {
					return {
						"::before": window.__cssValsToObj(window.getComputedStyle(el, "::before"), window.__getAllCssPropList()),
						"::after": window.__cssValsToObj(window.getComputedStyle(el, "::after"), window.__getAllCssPropList())
					};
				});
				// looking for items to wrap
				const txtChildEls = Array.from(aControlEl.childNodes).filter(el => {
					return el.nodeType === document.TEXT_NODE;
				});
				// handling a special case of flexbox + <br>
				__handleFlexBr(aControlEl, nonTxtChildEls);
				// actual replacement
				const _preH = window.getScrlEl().scrollHeight;
				// checking if white-space should be not removed, even if it's zero-sized
				const ifKeepWhSpace = ___checkIfWhSpaceShouldBeAlwaysKept(aControlEl);
				// ensuring end-of-line white spaces aren't zero-sized --- otherwise we sometimes have text shifts when we remove it
				const _oldWhSp = aControlEl.style.getPropertyValue("white-space");
				const _oldWhSpPriority = aControlEl.style.getPropertyPriority("white-space");
				aControlEl.style.setProperty("white-space", "nowrap", "important"); // puts all in 1 line -- no end-of-line zeroing
				// replacing
				txtChildEls.forEach((el, i) => {
					// const _origHeight = window.getScrlEl().scrollHeight;
					if (!ifKeepWhSpace && !el.nodeValue.trim().length && __isTxtNodeZeroSize(el)) {
						// this an empty, whitespace text node --> remove it
						el.remove();
					} else {
						const span = window.__makeCleanSpan();
						span.textContent = el.nodeValue;
						span._origElTag = aControlEl.tagName;
						el.replaceWith(span);
						changesStore.push({
							el: el,
							span: span
						});
					}
					// NOTE: only enable when investigating
					// if(_origHeight !== window.getScrlEl().scrollHeight){
					// 	debugger;
					// 	console.error("scrollingElement.scrollHeight has changed.", _origHeight, window.getScrlEl().scrollHeight, window.__el2stringForDiagnostics(aControlEl));
					// }
				});
				// cancelling out our changes to CSS white space handling
				aControlEl.style.setProperty("white-space", _oldWhSp, _oldWhSpPriority);
				// checking for changes in neighboring elements -- could happen if, e.g., CSS uses element-specific padding/margins
				if (txtChildEls.length && nonTxtChildEls.length) { // if there was smth to be changed/affected
					nonTxtChildEls.forEach((el, i) => ___revertStyleChanges(el, nonTxtChildElStyles[i], nonTxtChildElPseudoStyles[i]));
				}
				if (_preH !== window.getScrlEl().scrollHeight) {
					debugger;
					console.error("scrollingElement.scrollHeight has changed.", _preH, window.getScrlEl().scrollHeight, window.__el2stringForDiagnostics(aControlEl));
				}
				return aControlEl;
			},
			__unwrapTextNodesFromSpans: function() {
				var pair;
				while ((pair = changesStore.pop()) !== undefined) {
					pair.span.replaceWith(pair.el);
				}
				console.assert(!changesStore.length, "We haven't restored some textNodes back from spans!", window.location.href);
				cssInjctr._removeAllCss();
			}
		};
	})();
	
	function __handleFlexBr(aControlEl, nonTxtChildEls){
		// flexbox doesn't respect br, but text nodes do -- we need an extra span to keep text nodes in during wrapping
		const cntrlSt = window.getComputedStyle(aControlEl);
		if(cntrlSt.display.includes("flex") && nonTxtChildEls.some(el=>el.tagName.toLowerCase() === "br")){
			const elRuns = [[]]; // because we only want contigous runs of text+br to be wrapped in their spans - otherwise we just keep elements untouched
			for(const child of aControlEl.childNodes){
				if(child.nodeType === document.TEXT_NODE || (child.nodeType === document.ELEMENT_NODE && child.tagName.toLowerCase() === "br")){
					elRuns[elRuns.length-1].push(child);
				}else{
					elRuns.push([]); // adding an array to save another run
				}
			}
			// filtering out non-runs
			//NOTE: checking for document.ELEMENT_NODE is enough -- we only take <br> Elements
			elRuns.filter(elRun=>elRun.length > 2 && elRun.some(x=>x.nodeType===document.ELEMENT_NODE)).forEach((elRun, i) => {
				console.warn("[WRAP] Flex-box text/br items are wrapped in their span");
				const span = window.__makeCleanSpan();
				span._origElTag = aControlEl.tagName;
				aControlEl.insertBefore(span, elRun[0]);
				elRun.forEach((item, i) => span.append(item));	
				// FIXME: Save these changes, so they can be rolled back				
			});
		}
	}

	function _getVisibleElements() {
		// NOTE account for the z-index <-- we shouldn't do it here
		var jqAllVis = $(":visible");
		// Filter out the insides of <svg> -- they are like a mini version of HTML, but we'll treat them as a brick
		jqAllVis = jqAllVis.not(jqAllVis.filter("svg").find("*"));
		// check if height or width are 0 or are tiny
		jqAllVis = jqAllVis.filter(function(i, el) {
			const bbox = el.getBoundingClientRect(); // here strictly the native version only - if zero-sized, then not visible
			return bbox.height * bbox.width > 0.99;
		});
		// Handle expandable Controls <== Partially for NOw: TODO: handle <option> group labels occupying space and being visible
		const jqAllSelect = jqAllVis.find("select");
		const invisOptionArrArr = jqAllSelect.toArray().map((el) => {
			const allOpts = Array.from(el);
			if (el.size > 0) {
				return allOpts.slice(el.size); // from next till the end
			}
			return allOpts.find(opt => opt.selected !== true) || allOpts.slice(1);
		}).filter(el => el);
		jqAllVis = jqAllVis.not(...invisOptionArrArr);
		// apply additional visibility filters
		jqAllVis = jqAllVis.filter((i, el)=> {
			const style = window.getComputedStyle(el);
			return style["visibility"] === "visible";
		});
		//filter out elements with opacity < 0.1 and their descendants - it's not recalculated for descendants and shown as 1
		const transpElArrArr = jqAllVis.filter((i, el) => {
			var style = window.getComputedStyle(el);
			return parseFloat(style["opacity"]) < 0.1; // we define things below this threshold as invisible
		}).toArray().map((el) => {
			return $(el).find(":visible").add(el).toArray();
		}).flat();
		jqAllVis = jqAllVis.not(transpElArrArr);
		// filter out descendants of elements with overflow:hidden if they are outside of the element
		// NOTE: we can't use document.elementFromPoint instead - again, because we'll need to choose a single point and there may be partial overlap, PLUS, we don't know what will be on top, covering other elements still visible.
		jqAllVis = jqAllVis.filter((i, el) => {
			const b = window._getAbsBoundingRectAdjForParentOverflow(el, true);
			const largerThanAPixel = Math.max(b.height, 0) * Math.max(b.width, 0) > 2; // so we avoid pixels
			const hasSampleableBody = b.height >= 1 && b.width >= 1; // sometimes width/height are .99 or so, so it's less than a pixel to sample from a canvas
			const withinWindow = b.left < (window.__getSaneDocScrollWidth() - 3) && b.top < (window.getScrlEl().scrollHeight - 3); // because right/bottom are the outer boundaries <-- rects start from 0s, but don't include right/bottom coords // NOTE: -3 cause I'm ok with tiny things cropped out
			// if(el.tagName && el.tagName.toLowerCase() === "div" && el.classList.contains("slide-out-div")){
			// 	const b2 = window._getAbsBoundingRectAdjForParentOverflow(el, true, false, "normal", {logClippingParents: true});
			// 	console.log("[reCAPTCHA] adjusted BBox:", JSON.stringify(b), "ORIG bbox: ", JSON.stringify(el.getBoundingClientRect()), "RE ADJ: ", JSON.stringify(b2));
			// 	debugger;
			// }
			return largerThanAPixel && withinWindow && hasSampleableBody;
		});
		// filter out elements that do not have anything visible to them, e.g., 'area' and 'map
		jqAllVis = __filterElements(jqAllVis, _tagSets.invisible, true);
		return jqAllVis;
	}

	function _detectPseudoElIcons(jqAllVis) {
		// 0 - Filter out Nodes that are content
		const tags = new Set([..._tagSets.controls, ..._tagSets.styledAsControls, ..._tagSets.media, ..._tagSets.invisible, "iframe"]);
		const jqNonContent = __filterElementsNoParentMatch(jqAllVis, tags, true);
		// 1 - find all elements with no element children <-- we can only save parent's NODE as a reference, pseudo elements can't be saved/referenced with js
		const jqNoChildrenEls = jqNonContent.filter((i, el) => {
			return !el.children.length;
		});
		// 2 - filter out elements with visible text nodes
		const jqNoTextLeafs = jqNoChildrenEls.not(_filterOutInvisibleText(jqNoChildrenEls)).add(jqNoChildrenEls.not(_getOnlyElementsWithText(jqNoChildrenEls)));
		// __replacesPseudoCnt
		// 3 - keep elements with glyphs/graphics in their :after and :before pseudoElements
		const jqNodesWithPseudoContent = jqNoTextLeafs.filter((i, el) => {
			const psdCntB = __testPseudoContentForIcons(el, "::before");
			const psdCntA = __testPseudoContentForIcons(el, "::after");
			if (psdCntB) {
				el.__pseudoType = psdCntB;
				el.__pseudoPrx = "::before";
			}else if(psdCntA){
				el.__pseudoType = psdCntA;
				el.__pseudoPrx = "::after"; // we'll reuse it while scrambling/blackening
			}
			return (psdCntB || psdCntA);
		});
		// 4 - Adding spans with symbols that were pseudoElements before Dom prep
		const formerPseudoEls = jqAllVis.filter($("span").filter((i, el)=>el.__wasPseudoEl));
		return jqNodesWithPseudoContent.add(formerPseudoEls);
	}

	function __testPseudoContentForIcons(el, pseudo = "::before", preCmpCnt = null) {
		const cnt = preCmpCnt || window.getComputedStyle(el, pseudo).content;
		if (cnt === "none") {
			return false;
		}
		if (cnt.indexOf("url") === 0 || cnt.indexOf("image-set") === 0) {
			return "img"; // these are images -- take them
		}
		const glyphChar = /^["'](.)["']$/.exec(cnt);
		if (glyphChar && glyphChar[1] && glyphChar[1].trim().length) {
			return "glyph"; // this is a non-empty single-character glyph
		}
		// if(cnt.length > 3){
		// 	return false; // some text content -- ignore it for now
		// }
		// if(cnt.length === 0){
		// 	return false; // no content
		// }
		return false;
	}


	function _filterOutInvisibleText(jqAllVis) {
		// filter out elements with "0px" font size or "transparent" color; New addition: checking text-intend
		const rng = document.createRange();
		jqAllVis = jqAllVis
			.filter((i, el)=>{
				// Filter out spans that were pseudoElements with text earlier
				return !el.__wasPseudoEl;
			})
			.filter(function(i, el) {
				const st = window.getComputedStyle(el);
				// console.assert(style["color"].indexOf("rgb") > -1, "Computed color isn't in RGB(a)! for ", this.tagName, "classes: ", this.classList);
				const textColor = window._cssCol2RgbaArr(st["color"]);
				const fSize = parseFloat(st.getPropertyValue("font-size"));
				return (fSize > MIN_VIS_FONT_SIZE && (textColor[3] === undefined || textColor[3] > MIN_VISIBLE_OPACITY));
			})
			.filter((i, el) => {
				if (el._origElTag !== undefined) {
					// that's out replaced span -- no need to check it; getAllVis already takes care of this
					return true;
				}
				// if text-indent is tempered with
				const st = window.getComputedStyle(el);
				const txtIndent = parseFloat(st["text-indent"]);
				console.assert(!isNaN(txtIndent), "Couldn't parseFloat text indent: ", st["text-indent"]);
				if (txtIndent === 0) {
					return true; // all good
				}
				const txtSubNodes = Array.from(el.childNodes).filter(x => x.nodeType === document.TEXT_NODE);
				if (!txtSubNodes.length) {
					return true; // this is a control element - just keep it
				}
				// at least one is on the screen
				return txtSubNodes.some(txtNode => {
					rng.selectNode(txtNode);
					const b = rng.getBoundingClientRect();
					// FIXME: This doens't account for overflow possibly hiding shifted text -- we only check if it's inside the window				
					return b.right > 0 && b.left < window.__getSaneDocScrollWidth() && b.height && b.bottom > 0 && b.top < window.getScrlEl().scrollHeight;
					// return b.right > 0 && b.left < window.getScrlEl().scrollWidth && b.height && b.bottom > 0 && b.top < window.getScrlEl().scrollHeight;
				});
			});
		return jqAllVis;
	}

	function _getControlsWithText(jqAllVis) {
		// assign default values to Submit, Reset - otherwise they have no value; We can't do anything about input[date]
		jqAllVis.filter("input[type=submit]").each((i, el) => {
			if (!el.value) {
				el.value = "Submit Query";
			}
		});
		jqAllVis.filter("input[type=reset]").each((i, el) => {
			if (!el.value) {
				el.value = "Reset";
			}
		});
		// keep Form/Control elements with text, but no textNode in them
		const jqInputsWithText = jqAllVis.filter("textarea, button, input, option").filter((i, el) => {
			// NOTE: we already ensure upstream only visible <options> are passed down to us
			if (el.tagName.toLowerCase() !== "input") {
				return true;
			}
			return _tagSets.inputTypesWithText.has(el.type.toLowerCase());
		}).filter((i, el) => {
			// new addition: if there are nested elements - we don't take it, since it's a composite control -- handled separately
			if (el.children.length) {
				console.warn("Found a control with nested elements in it:", window.__el2stringForDiagnostics(el));
				return false;
			}
			var str;
			if (el.tagName.toLowerCase() === "input") {
				str = el.value || el.placeholder || "";
			} else {
				str = (el.childNodes[0]) ? el.childNodes[0].textContent : (el.value || el.placeholder || ""); // textarea, button, and option all have a textNode in them
			}
			return str.trim().length;
		}).filter((i, el) => {
			// some rudimentary fix // FIXME: Do proper estimation if text is onscreen
			// note: I don't know why designers do that to me....
			const indent = parseFloat(window.getComputedStyle(el)["text-indent"]);
			return indent > -window.__getSaneDocScrollWidth() && indent < window.__getSaneDocScrollWidth();
			// return indent > -window.getScrlEl().scrollWidth && indent < window.getScrlEl().scrollWidth;
		}).filter((i, el) => {
			const b = window._getInnerBBox(el);
			return b.width > 0 && b.height > 0; // this should work for the insides of controls, even if they are floated etc.
		});
		return jqInputsWithText;
	}

	function _getOnlyElementsWithText(jqAllEls) {
		// filter down to elements with a direct textNode descendant
		return jqAllEls.not("textarea, button, option").filter(function() {
			if (this.childNodes.length) {
				for (var i = this.childNodes.length; i--;) {
					const el = this.childNodes[i];
					if (el.nodeType === 3 && window.cleanString(el.textContent.trim()).length) {
						return true;
					}
				}
			}
			return false;
		});
	}

	function __isItUI(bbox, isItRealImg = false) {
		const thr = isItRealImg?IMG_UI_SIZE_NONBG:IMG_UI_SIZE;
		return (bbox.height <= thr || bbox.width <= thr) && Math.max(bbox.width, bbox.height) >= 1.5 * Math.min(bbox.width, bbox.height);
	}

	function __isItIcon(bbox, isItRealImg = false) {
		const thr = isItRealImg?IMG_ICON_SIZE_NONBG:IMG_ICON_SIZE;
		return bbox.width <= thr && bbox.height <= thr && Math.max(bbox.width, bbox.height) <= 1.5 * Math.min(bbox.width, bbox.height); //bbox.width===bbox.height;
	}

	function createFToggleDomPrepForInstaManip() {
		// preps DOM for manipulating elements instantaneously -- needed for, e.g., removing overlays before screenshotting some elements
		var _jqAllVis; // = $(":visible"); // keep a reference
		var state = "off";
		return function(onOff = "on", settings = {
			refresh: false
		}) {
			console.assert(onOff === "on" || onOff === "off");
			if (state === onOff) {
				return; // do nothing, it's already the right way
			}
			if (settings.refresh) {
				_jqAllVis = undefined;
			}
			if (_jqAllVis === undefined) {
				_jqAllVis = $(":visible"); // creating a collection during the 1st call <-- Otherwise it's created when scripts are loaded, which is often before some elements are visible/loaded
			}
			// console.log("Turning transitions/animations", onOff, " for nEl:", _jqAllVis.length);
			if (onOff === "on") {
				// window.__setCSSPropJqArr(_jqAllVis, "animation-name", "none", "important");
				// Saving original computed Props for transition and animation
				_jqAllVis.toArray().forEach(el => {
					if(!el._origCmpCSS){
						const st = window.getComputedStyle(el);
						const pL = ["transition-property", "transition-duration", "transition-timing-function", "transition-delay", "animation-play-state"];
						el._origCmpCSS = window.__cssValsToObj(st, pL);	
					}
				});
				// Some animations are needed for elements to appear visible at the start -- pausing instead of removing
				window.__enforceManyCSSPropOnElArr(_jqAllVis, {"animation-play-state": "paused", "transition": "all 0s 0s"});				
				// window.__setCSSPropJqArr(_jqAllVis, "animation-play-state", "paused", "important");
				// window.__setCSSPropJqArr(_jqAllVis, "transition", "all 0s 0s", "important");
			} else {
				window.__restoreManyCSSPropOnElArr(_jqAllVis, ["animation-play-state", "transition"]);
				// window.__restoreCSSPropJqArr(_jqAllVis, "animation-play-state");
				// window.__restoreCSSPropJqArr(_jqAllVis, "transition");
			}
		};
	}

	// DEPRECATED: switch to the sync version _el2canvasNoOverlays
	function _el2canvasNoOverlaysAsync(el, bbox, hideChildren = true, jqOverlays, whiteBg = false) {
		// NOTE: we should use getOtherGrPromise("hoveringItems") instead of getSemanticGrPrms("overlays") <-- Hovering items sometimes cover background images, which we want to screenshot
		return ((jqOverlays) ? Promise.resolve(jqOverlays) :
			jqG.getOtherGrPromise("hoveringItems")).then(_jqOverlays => {
			return _el2canvasNoOverlays(el, bbox, hideChildren, _jqOverlays, whiteBg);
		});
	}


	function _el2canvasNoOverlays(el, bbox, hideChildren = true, jqOverlays, whiteBg = false) {
		// NOTE: we should use getOtherGrPromise("hoveringItems") instead of getSemanticGrPrms("overlays") <-- Hovering items sometimes cover background images, which we want to screenshot
		jqOverlays = jqOverlays || _findAllPositionedEls();
		var jqElsToHide = _findCoveringOverlays(el, jqOverlays);
		jqElsToHide = jqElsToHide.add(jqElsToHide.find(":visible"));
		var txtElsToHide;
		if (hideChildren) {
			const _elDesc = $(el).find(":visible");
			jqElsToHide = jqElsToHide.add(_elDesc); // el's inside elements - when it's about a bg element
			txtElsToHide = [el].concat(_elDesc.toArray());
			window.__setCSSPropJqArr(txtElsToHide, "color", "transparent", "important"); // hide texts inside an element
		}
		// make sure transitions/animations are instantaneous // fool check
		if (jqElsToHide.length) {
			const tmpEl = jqElsToHide.toArray().find(x => x["_oldVal_transition"] === undefined);
			if (tmpEl !== undefined) {
				console.error("We forgot to zero transitions/animations --> do it upstream, ", window.__el2stringForDiagnostics(tmpEl)); // we can't use assert -- it requires tmpEl in any case as an input, which we don't have if all is ok
				debugger;
			}
		}
		// hide interfering elements
		window.__setCSSPropJqArr(jqElsToHide, "visibility", "hidden", "important");
		window.__setCSSPropJqArr(jqElsToHide, "opacity", "0", "important");
		// get a canvas
		const canvas = (whiteBg) ? _el2canvasWhiteBG(el, bbox) : window.screenPart2Canvas(bbox);
		// restore everything
		window.__restoreCSSPropJqArr(jqElsToHide, "visibility");
		window.__restoreCSSPropJqArr(jqElsToHide, "opacity");
		if (hideChildren) {
			window.__restoreCSSPropJqArr(txtElsToHide, "color");
		}
		// return 
		return canvas;
	}

	function _el2canvasWhiteBgNoOverlaysAsync(el, bbox, hideChildren = true, _jqOverlays) {
		const whiteBg = true;
		return _el2canvasNoOverlaysAsync(el, bbox, hideChildren, _jqOverlays, whiteBg);
		// var jqElsToHide = window._findCoveringOverlays(el, _jqOverlays);
		// jqElsToHide = jqElsToHide.add(jqElsToHide.find(":visible"));
		// if(hideChildren){
		// 	jqElsToHide = jqElsToHide.add($(el).find(":visible")); // el's inside elements - when it's about a bg element
		// 	window.__setCSSPropJqArr([el], "color", "transparent", "important"); // hide texts inside an element
		// }
		// // make sure transitions/animations are instantaneous // fool check
		// jqElsToHide.length && console.assert(jqElsToHide[0]["_oldVal_transition"] !== undefined, "We forgot to zero transitions/animations --> do it upstream, ", window.location.href, "el:", jqElsToHide[0].tagName, "outerhtml:", jqElsToHide[0].outerHTML);
		// // hide interfering elements
		// window.__setCSSPropJqArr(jqElsToHide, "visibility", "hidden", "important");
		// window.__setCSSPropJqArr(jqElsToHide, "opacity", "0", "important");
		// // get a canvas
		// const canvas = _el2canvasWhiteBG(el, bbox);
		// // restore everything
		// window.__restoreCSSPropJqArr(jqElsToHide, "visibility");
		// window.__restoreCSSPropJqArr(jqElsToHide, "opacity");
		// if(hideChildren){
		// 	window.__restoreCSSPropJqArr([el], "color");
		// }
		// // return 
		// return canvas;
	}

	function _el2canvasWhiteBG(el, bbox) {
		bbox = bbox || window._getAbsBoundingRectAdjForParentOverflow(el);
		// 1 - check if the element already has backgroundColor
		const bgC = window.getComputedStyle(el).backgroundColor;
		if (bgC === "rgba(0, 0, 0, 0)" || bgC.indexOf("0)") > -1) {
			// 2 - add a non-transparent background to the element - needed for correct avgColor we're screenshotting an overlay
			window.__setCSSPropJqArr([el], "background-color", "rgba(0, 0, 0, 0.7)", "important");
			// This partially-transp bg is a trade-off - it allows for a fairly accurate VC analysis if there was a messy bg, and also shows a bit what was actually underneath
			let canvas = window.screenPart2Canvas(bbox);
			// 3 - restore the element orig bg
			window.__restoreCSSPropJqArr([el], "background-color");
			return canvas;
		}
		return window.screenPart2Canvas(bbox);
	}

	function _findCoveringOverlays(el, _jqOverlays) { // we need this for an accurate avg color -- when scrambling
		return _jqOverlays.filter(function() {
			if ($(el).closest(this).length) {
				// el is inside/equals an overlay element - not hiding
				return false;
			}
			// checking if overlay is on top and overlaps with the 'el'; if yes - hiding
			const theyOverlap = window._do2elsOverlap(el, this);
			const overlayAbove = window._is1stElAbove2ndEl(this, el);
			return theyOverlap && overlayAbove;
		});
	}

	function __isThisBBoxStickyMenu(bbox) {
		// only to be used with position:fixed
		const FULL_SCREEN_WIDTH = window.innerWidth * 0.9; // it's safe to use innerWidth - we have scrollbars removed on a browser window
		const FULL_SCREEN_HEIGHT = window.innerHeight * 0.9;
		// const FULL_SCREEN_HEIGHT = window.__glSettings.browserWindowSize.h * 0.9; // because we changed tab H to fit all of its content
		// const TOP_SCREEN_POSITION = 5; // not 0, just in case of some error creeping in in _getAbsBoundingRectAdjForParentOverflow
		const isItAttachedToTop = (bbox.top < 5 && bbox.top > -5);
		const isItAttachedToBottom = (bbox.bottom < (window.innerHeight + 5) && bbox.bottom > (window.innerHeight - 5));
		const isItAttachedToLeft = (bbox.left < 5 && bbox.left > -5);
		const isItAttachedToRight = (bbox.right > (window.innerWidth - 5) && bbox.right < (window.innerWidth + 5));
		if (bbox.width > FULL_SCREEN_WIDTH && bbox.height > FULL_SCREEN_HEIGHT) {
			return false; // it's a full-screen overlay
		}
		// if (bbox.width > FULL_SCREEN_WIDTH && (isItAttachedToTop || isItAttachedToBottom)) {
		// 	return true;
		// }
		// if (bbox.height > FULL_SCREEN_HEIGHT && (isItAttachedToLeft || isItAttachedToRight)) {
		// 	return true;
		// }
		// NOTE: now we return menu position - cause we now save them and move bottom menus off screen
		if (bbox.width > FULL_SCREEN_WIDTH) {
			if(isItAttachedToTop){
				return "top";
			}else if(isItAttachedToBottom){
				return "bottom";
			}
		}
		if (bbox.height > FULL_SCREEN_HEIGHT) {
			if(isItAttachedToLeft){
				return "left";
			}else if(isItAttachedToRight){
				return "right";
			}
		}
		return false; // it's a smaller overlay
	}

	function __checkIfOverlTransp(overEl, allPrimEls) {
		// NOTE: all of the checks before comparing with/without-overlay screenshots are there to speed up computations
		// 1 - if the overlay has visible primitives, keep it - it's not transparent
		if (allPrimEls.some(primEl => overEl.contains(primEl))) {
			return false;
		}
		// 2 - otherwise, take a screenshot with/without the overlay and compare pixel difference <== EXPENSIVE. Any better solution?...
		const toleranceThr = 5; // UInt8 difference across 3 channels
		const bbox = window._getAbsBoundingRectAdjForParentOverflow(overEl, true);
		const cnvs1 = window.screenPart2Canvas(bbox);
		window.__setCSSPropJqArr([overEl], "opacity", "0", "important");
		const cnvs2 = window.screenPart2Canvas(bbox);
		window.__restoreCSSPropJqArr([overEl], "opacity");
		const {
			canvasesAreSame
		} = window.getCnvsDiff(cnvs1, cnvs2, toleranceThr, {
			quickDiffOnly: false
		});
		return canvasesAreSame; // if canvasesAreSame, then the overEl is transparent
	}

	function _findActualOverlays(graphElArrFull) { // we need this for an accurate avg color -- when scrambling
		// NOTE: we don't use jqG.getOtherGrPromise because Promises become circular
		const jqAllHovering = _findAllPositionedEls().filter((i, el) => {
			// main body isn't an overlay, but can be shifted for 'sticky' menus
			return (el !== document.body && el !== document.documentElement);
		});
		// EXTRA: we have too many miscalssifications -- exclude all bg.main graphics from primitives
		const graphElArr = graphElArrFull.filter((i, el) => el._gType !== window.graphTypes.bgMain);
		// END EXTRA
		const jqAllPrimitives = jqG.getTxtGr("allNoCntrl").add(jqG.getCntrlGr("real")).add(graphElArr);
		const hovElArr = jqAllHovering.toArray();
		const stickyMenus = [];
		let jqOverl = jqAllHovering.filter((i, elHover) => {
			// z - If elHover is fixed, keep it as an overlay
			const bboxHoverEl = window._getAbsBoundingRectAdjForParentOverflow(elHover, true);
			const st = window.getComputedStyle(elHover);
			// if (st["position"] === "fixed") {
			// 	// unless it's full-width/height and attached to the top/bottom (but not full screen)
			// 	return !__isThisBBoxStickyMenu(bboxHoverEl); // sticky menus aren't overlays
			// }
			if (st["position"] === "fixed" || st["position"] === "sticky") {
				// unless it's full-width/height and attached to the top/bottom (but not full screen)
				const menuPosition = __isThisBBoxStickyMenu(bboxHoverEl);
				if(menuPosition){
					// sticky menus aren't overlays
					elHover._stickyPosition = menuPosition;
					elHover._origBBox = bboxHoverEl; // saving cause we move bottom-window items down the page
					stickyMenus.push(elHover);
				}else if(st["position"] === "fixed"){
					// we only take "fixed" items as undisputed overlays -- "sticky" items need to pass the tests below (but we do need to try to register them as sticky menus)
					return true;
				}
			}
			// a - NEW: if overlay is below top screen, it's not an overlay (we have too many misclassifications with layering) <-- This one should cut out some false positives
			if(bboxHoverEl.top >= window.innerHeight){
				return false;
			}
			// a.1 - NEW: If an overlay contains no main graphics, it can't be transparent
			const hoverHasMainGr = graphElArrFull.toArray().filter(grEl=>grEl._gType === window.graphTypes.bgMain || grEl._gType === window.graphTypes.main).some(grMainEl=>elHover.contains(grMainEl));
			if(!hoverHasMainGr){
				// const primsInThisHover = jqAllPrimitives.filter((i, el)=>elHover.contains(el)).toArray();
				const size2checkThr = Math.abs(bboxHoverEl.width * bboxHoverEl.height) * 0.01;
				const els2checkBg = $(elHover).find(":visible").filter((i, el)=>{
					// filtering out tiny things
					const b = el.getBoundingClientRect();
					return (b.width * b.height) > size2checkThr;
				}).add(elHover).toArray();
				const someElsArentTransparent = els2checkBg.some(subHovEl=>{
					const bgSt = window.getComputedStyle(subHovEl);
					// FIXME: check for the last 0 of rgba; Maybe rely on our window.getBgColorAsync <-- though it's more expensive
					return bgSt.backgroundColor !== "rgba(0, 0, 0, 0)" && bgSt.backgroundImage !== "none";
				});
				if(!someElsArentTransparent){
					return false; // everything is transparent - this hover either captures clicks or a part of layering
				}
			}
			// b - exclude primitives that are inside of this/current hovering item
			// const jqHoverEl = $(elHover);
			const jqPrimOutsideThisHoverEl = jqAllPrimitives.filter((i, elPrim) => !elHover.contains(elPrim));
			// c - exclude primitives that don't overlap with the hover item
			const jqPrimOverlapThisHover = jqPrimOutsideThisHoverEl.filter((i, elPrim) => {
				if (!elPrim.__innerBbox) {
					elPrim.__innerBbox = window._getAbsBoundingRectAdjForParentOverflow(elPrim, true, false, "inner"); // simply for a speed-up - so we don't re-calc every cycle
				}
				const inToleranceThr = Math.min(elPrim.__innerBbox.width, elPrim.__innerBbox.height) / 2; // px
				return window._do2bboxesOverlap(bboxHoverEl, elPrim.__innerBbox, inToleranceThr);
			});

			// d - find primitives that are underneath a hovering item
			const jqPrimUnderThisHover = jqPrimOverlapThisHover.filter((i, elPrim) => {
				return window._is1stElAbove2ndEl(elHover, elPrim);
			});
			// d.1 - exclude primitives that are themselves hovering, are underneath the target item (because they passed the 'd' test above), and almost completely coincide/overlap the target element <-- these items are used to create layering, probably
			const jqPrimHoverToExclude = jqPrimUnderThisHover.filter((i, elPrim) => {
				return hovElArr.some(elOrigHover => elOrigHover.contains(elPrim));
			}).filter((i, elPrim) => {
				const prBBox = elPrim.__innerBbox;
				const maxWiggleVert = MAX_DIFF_TO_DISCARD_BBOXES_COINCIDE * bboxHoverEl.height;
				const maxWiggleHorz = MAX_DIFF_TO_DISCARD_BBOXES_COINCIDE * bboxHoverEl.width;
				return Math.abs(prBBox.top - bboxHoverEl.top) < maxWiggleVert && Math.abs(prBBox.bottom - bboxHoverEl.bottom) < maxWiggleVert && Math.abs(prBBox.left - bboxHoverEl.left) < maxWiggleHorz && Math.abs(prBBox.right - bboxHoverEl.right) < maxWiggleHorz;
			}).add(jqPrimUnderThisHover.filter((i, elPrim) => {
				// d.2 - exclude primitives that include the target hover -- such primitives can only be background-image elements <-- I'd expect them to be backgrounds, not actual content, so they don't define an overlay
				return elPrim.contains(elHover) && !elPrim.isSameNode(elHover);
			}));
			// e - count what's left; if nothing, then this hovering item is not an overlay, it's simply a positioned item
			return jqPrimUnderThisHover.not(jqPrimHoverToExclude).length;
		}).filter((i, overEl) => {
			return !__checkIfOverlTransp(overEl, jqAllPrimitives.toArray()); // transp els are thrown away
		});
		// Extra addition -- if overlays have 30%+ primitives, these aren't overlays -- it's a wacky parallax implementation ==> No overlays in this case
		const tmpOverlArr = jqOverl.toArray();
		const nPrimInOverl = jqAllPrimitives.filter((i, el)=>tmpOverlArr.some(oEl=>oEl.contains(el))).length;
		if(jqAllPrimitives.length  * MAX_PRIMITIVES_TO_CANCEL_OVERLAYS < nPrimInOverl){
			console.log("[SEMANTIC] Too many primitives in overlays ==> Presuming it's all about parallax and there are no overlays. nPrimInOverl:", nPrimInOverl, "jqAllPrimitives.length", jqAllPrimitives.length, location.href);
			jqOverl = $();
		}
		return {jqOverl: jqOverl, stickyMenus: stickyMenus};
	}

	const _findAllPositionedEls = (() => {
		var jqPos; // Keeping a reference for speedUp - we'll need it for quite a few things that I don't want to make async (calls to getOtherGrPromise)
		return function() {
			if (!jqPos) {
				jqPos = jqG.getAllVis().filter(function(i, el) {
					const st = window.getComputedStyle(el);
					return ["absolute", "relative", "fixed", "sticky"].includes(st["position"]);
				});
			}
			return jqPos;
		};
	})();

	function __wrapNakedTxtNodesInSpans() {
		// If a parent has non-text nodes and direct-text nodes, wrap direct-text nodes in spans -- otherwise they can't be recorded as 'primitives', and we have a mess identifying a semantic-group membership + Problems with Hierarchical clustring
		// 1 - Get all elements -- we should do it before detecting all visible else
		const jqAll = $("html").find(":visible"); // some primitive visibility detection
		// 1.1	- Removing comments from HTML - they aren't rendered, but counted in childNodes (and I rely on it being not there... I should instead simply check node type every time, but removing is easier)
		jqAll.each((i, el)=>{
			Array.from(el.childNodes).filter(subEl=>subEl.nodeType === document.COMMENT_NODE).forEach(subEl => {
				console.log("[REMOVING] a comment node: ", subEl.nodeValue);
				subEl.remove();
			});
		});
		// 2 - Handle the weird case of expandable <details> <-- their folded content shouldn't later found as visible, and wrapping them in a span should do the trick with BBox size check below
		jqAll.filter("details").each((i, el) => {
			__wrapTextNodesInSpans(el);
		});
		// 3 - Wrap other naked text nodes
		jqAll.not("details").each((i, el) => {
			if (el.children.length === el.childNodes.length) {
				return; // All children are elements
			}
			if (!el.childNodes.length) {
				return; // No elements at all
			}
			if (!el.children.length) {
				// All children are text
				// NEW extra: Normalizing -- so no text nodes are empty or direct siblings
				el.normalize(); // we do it here, because documentElement.normalize() changes smth big sometimes, and I'm not sure what -- so minimizing its impact by bringing its effects down the HTML tree
				const bgImg = window.getComputedStyle(el).getPropertyValue("background-image");
				if (bgImg.indexOf("url(") === -1) {
					return;
				}
				// else we need to detach bgImg from text
				console.log("A text node with bgImg detected -- detaching text from img", window.__el2stringForDiagnostics(el));
			}
			__wrapTextNodesInSpans(el);
		});
	}
	
	const {_marquee2div, _restoreMarquee} = (()=>{
		const marqueeDivPairs = [];
		return {
			_marquee2div(){
				document.querySelectorAll("marquee").forEach(mrq => {
					const hasVisNodes = Array.from(mrq.childNodes).some(x=>(x.nodeType === document.TEXT_NODE &&  x.nodeValue.trim().length) || x.nodeType === document.ELEMENT_NODE);
					if(!hasVisNodes){
						return; // no point replacing - this marquee has no content to scroll anyway
					}
					const div = document.createElement("div");
					const mrqSt = window.__cssValsToObj(window.getComputedStyle(mrq), window.__getAllCssPropList());
					mrq.childNodes.forEach(subNode => {
						const clone = subNode.cloneNode(true);
						// if(subNode.nodeType === document.ELEMENT_NODE){
						// 	clone._id = window._getElId(subNode);
						// }
						div.appendChild(clone);
					});
					// re-attach our generated ids to the cloned children
					const mrqDescendants = Array.from(mrq.querySelectorAll("*")).map(el=>{
						el._id = el.dataset.elGenId;
						console.assert(el._id);
						return el;
					});
					mrq.replaceWith(div);
					const divStToEnf = window.stripIdenticalCss(mrqSt, window.getComputedStyle(div));
					Object.assign(divStToEnf, {"overflow": "hidden", "overflowX": "hidden", "overflowY": "hidden"});
					window.__enforceCSSVals(div, divStToEnf);
					window.revert2PreCompStyles(mrqDescendants, "UIFrozen");
					marqueeDivPairs.push({mrq: mrq, div: div});
					// making sure that div has at least some text <-- so line-height is respected on the parent
					const hasVisTxtNodes = div.innerText.trim().length;//Array.from(div.childNodes).some(x=>x.nodeType === document.TEXT_NODE);
					if(!hasVisTxtNodes){
						const span = window.__makeCleanSpan();
						span.innerText = ".";
						span.style.color = "transparent";
						div.appendChild(span);
					}
					console.log("[PREPPING] %cReplacing <marquee> with a <div>", "color:lightblue;");
				});
			},
			_restoreMarquee(){
				marqueeDivPairs.forEach(pair => pair.div.replaceWith(pair.mrq));
				marqueeDivPairs.length = 0;
			}
		};
	})();

	const {
		_detachPseudoElements,
		_reattachPseudoElements
	} = (() => {
		const cssInjctr = new window.CssInjector();
		const addedElements = [];
		return {
			_detachPseudoElements() {
				// NOTE: I'll only do this for bgImg 
				// FIXME: Collect all pseudoRelated pre-processing here
				// NOTE: we only do this for after/before
				$("html").find(":visible").not("iframe").toArray().forEach((el, i) => {
					[true, false].forEach((ifBefore, i) => {
						const pseudoKey = ifBefore ? "::before" : "::after";
						const addF = ifBefore ? "prepend" : "append";
						const st = window.getComputedStyle(el, pseudoKey);
						if(st["content"] !== "none"){ // "content: none" is the only unique-to-pseudoEls way to hide
							const hasContent = __testPseudoContentForIcons(el, "doesntmatter", st["content"]);
							const hasRealChildren = el.childNodes.length > 0;
							// st["content"].indexOf("url(") > -1
							if (st["background-image"].indexOf("url(") > -1 || (hasContent && hasRealChildren)) {
								// we have a background image -- do replacement
								// 0 - Make span
								const span = window.__makeCleanSpan();
								// 1 - Textual content doesn't show up in non-PseudoElements --> insert it as strings in clean spans
								if(hasContent === graphTypes.glyph){
									span.__wasPseudoEl = true;
									span.__pseudoType = hasContent; // Leave a flag for us to not include this span in text collections -- it should be an image
									span.__pseudoPrx = pseudoKey;
									span.textContent = st.content.replaceAll(/["']/g, "");
								}
								span._origElTag = el.tagName.toLowerCase() + pseudoKey;
								// 2 - add our span in DOM
								el[addF](span);
								addedElements.push(span);
								// 3 - copy up styles on an empty span
								const oldSt = window.getPreComputedStyles(el, "UIFrozen", pseudoKey);
								const stToEnf = window.stripIdenticalCss(oldSt, window.getComputedStyle(span));
								// const stToEnf = window.__cssValsToObj(st, window.__getAllCssPropList());
								// 3.1 - NEW extra -- SVG contents don't scale properly --> keep them as pseudoElements
								if(st["content"].indexOf(".svg") > -1 || st["content"].indexOf("</svg>") > -1){
									span.classList.remove("__clean-span");
									span.classList.add("__clean-span-for-svg");
									span.__pseudoHasImg = true; // not great (pseudoElement can be positioned -- getBoundingClientRect won't work properly), but I don't see other solutions
									cssInjctr._injectCss1Element(span, pseudoKey, stToEnf);
								}else{
									window.__enforceCSSVals(span, stToEnf);
								}
								// 4 - make a pseudo element invisible
								cssInjctr._injectCss1Element(el, pseudoKey, {"display": "none !important"});
								console.log("[ALTERATION] Extracted a pseudo bgImg in a span", pseudoKey, window.__el2stringForDiagnostics(el));
								// }
							}	
						}
					});
				});
			},
			_reattachPseudoElements(){
				cssInjctr._removeAllCss();
				addedElements.forEach(el=>el.remove());
			}
		};
	})();

	// FIXME: REVERT changes before HTML saving
	function __makeCrossOrigStylesheetsAccessible() {
		Array.from(document.getElementsByTagName("link")).filter(linkEl => linkEl.rel === "stylesheet").filter(linkEl => {
			// checking for media queries -- only applied stylesheets need to be internalized -- if not applied, remove
			if (!window.matchMedia(linkEl.media).matches) {
				linkEl.remove();
				return false;
			}
			
			return true;
		}).filter(linkEl => {
			// only external stylesheets need this modifications
			return !linkEl.href.startsWith(window.location.origin) && linkEl.href.indexOf("http") === 0;
		}).forEach(linkEl => {
			// linkEl.setAttribute("crossOrigin", "anonymous");
			const linkTmpl = `<style type="text/css">@import url("${linkEl.href}");</style>`;
			const newLinkEl = $(linkTmpl)[0];
			linkEl.replaceWith(newLinkEl);
			// linkEl.remove();
			// document.head.appendChild(newLinkEl);
			console.warn("An external stylesheet detected:", linkEl.href, "WHILE AT", window.location.href);
		});
	}

	const {
		__assignVisInnerText,
		_getVisInnerTxt
	} = (() => {
		var innerVisTxtAssigned = false;
		return {
			__assignVisInnerText(jqAllTxt, jqAllVis) {
				// saves visible innerText for each visible element <-- So I don't re-calc it every time for my multiple innerText.length related tests/classifications
				innerVisTxtAssigned = true;
				const allVisTxtEls = jqAllTxt.toArray();
				jqAllVis.toArray().forEach((el, i) => {
					el.__visInnerText = allVisTxtEls.filter(txtEl => el.contains(txtEl)).map(txtEl => window.__getTextNoCleaning(txtEl) || "").join("");
				});
				console.log("[ASSIGNED] All visInnerTexts");
			},
			_getVisInnerTxt(el, settings = {
				noWarning: false
			}) {
				// should only be used where node.innerText would have been used otherwise
				if (!settings.noWarning && el.__visInnerText === undefined && innerVisTxtAssigned) {
					console.warn("We didn't assign __visInnerText to an element", window.__el2stringForDiagnostics(el)); // NOTE: this is possible for found group elements -- we often look up the DOM tree, passing by elements classified as invisible (e.g., due to floats etc)
				}
				return el.__visInnerText || el.innerText || ""; // to swallow rare errors
			}
		};
	})();
	
	const {prepDomForDataExtractionAsync, restoreDomAfterDataExtraction} = (()=>{
		var _cleanUpStyleReversingF;
		return {
			restoreDomAfterDataExtraction() { // safe to call even if DOM hasn't been altered
				__unwrapTextNodesFromSpans(); // currently nothing but this
				_reattachPseudoElements();
				unhideInvisFixedEls();
				_restoreMarquee();
				_cleanUpStyleReversingF(); // if it's not assigned, let it fall and debug
				// readdNoScript();
			},
			prepDomForDataExtractionAsync(diffCheckNeeded = false) {
				console.log("PREPPING", location.href);
				// some permanent alterations to DOM needed for our Data Extractions
				return new Promise(function(resolve, reject) {
					var outRes = null;
					// const allEls = Array.from(document.body.querySelectorAll("*"));
					const elsToTrackCssFor = window.findElsStyledByOrder();
					console.log("[PREPPING] N els to reverse changes to (cause styled by tree-based selectors):", elsToTrackCssFor.length);
					// // 3.3 - Removing <noscript> so they don't affect our lists of invisible elements
					// removeNoScript();
					// 1 - make dom maniplation instant -- so out diff checks actually pick them up <== We should do that prior to screenshot taking - otherwise comparisons show a diff due to animations
					window.toggleDomPrepForInstaManip("on");
					if (diffCheckNeeded) {
						// 2 - Take a full-page screeonshot 
						var pageCnvsBefore = window.getStoredFullPageCanvas(); // window.page2Canvas(true);
						// jqG.origPageCnvs = pageCnvsBefore; // saving for the future use
					}
					// 2 - Prep stylesheets
					__makeCrossOrigStylesheetsAccessible();
					// 3.0 - Replacing marquee with divs
					_marquee2div(); // cause marquee causes trouble and often has no text, looking broken/empty
					// 3.1 - Extract pseudo graphics in separate elements
					_detachPseudoElements(); // this generates new <spans>, which affects what needs wrapping -- do it before wrapping
					// 3.2 - Do alterations
					__wrapNakedTxtNodesInSpans();
					// A bit of time for reflow to happen - otherwise we have false-flag differences
					// 3.3 - Hide outsideViewport fixed els <== TODO: move before taking 1st canvas to avoid false flags <-- after a debug
					hideInvisFixedEls();
					// 3.4 - appling CSS that no longer applies due to nth-child and nth-of-type being messed up (because of our element inserting above)
					_cleanUpStyleReversingF = window.revert2PreCompStyles(elsToTrackCssFor, "UIFrozen");
					window.setTimeout(()=>{
						// 4 - Take another screenshot and compare/save the difference -- there should be any
						if (diffCheckNeeded) {
							var pageCnvsAfter = window.page2Canvas(true);
							const diffThr = 2;
							const {
								sizeDiff,
								wDiff,
								hDiff,
								canvasesAreSame,
								diffCnvs,
								accuDiff
							} = window.getCnvsDiff(pageCnvsBefore, pageCnvsAfter, diffThr);
							if (!canvasesAreSame) {
								debugger;
							}
							console.assert(canvasesAreSame, "Visual Difference after manipulation, total size diff in pixels:", sizeDiff, "wDiff: ", wDiff, "hDiff:", hDiff, "total pixel value Diff: ", accuDiff, window.location.href);
							// TODO log differences in console
							outRes = {
								accuDiff: accuDiff,
								diffCnvs: diffCnvs
							};
						}
						// 5.1 - Clean up
						window.toggleDomPrepForInstaManip("on", {
							refresh: true
						}); // refreshing due to us adding spans
						// window.toggleDomPrepForInstaManip("off", {
						// 	refresh: true
						// }); // refreshing due to us adding spans
						// 5.2 - ensuring getAllVis collections are refreshed
						jqG.__elStore.allVis = null;
						// 5.4 - Saving computed styles for all visible elements
						document.documentElement.dispatchEvent(new Event("DOMPrepped"));
						console.log("DONE PREPPING", location.href);
						resolve(outRes);
						// return outRes;
					}, 300);
				});
			}	
		};
	})();
	
	const {hideInvisFixedEls, unhideInvisFixedEls} = (()=>{
		// Fixed elements that are moved outside viewport are never visible to the user, but appear on our full-page screenshots -- Hide them
		const cssInjctr = new window.CssInjector();
		var elsToHide, elsToShow;
		return {
			hideInvisFixedEls(){
				// 1 - Find fixed els, with containing block being Viewport <-- FF only solution
				const fixedEls = $(":visible").not("html, body").toArray().filter(el=>{
					return window.getComputedStyle(el).position === "fixed" && document.body.isSameNode(el.offsetParent);
				});
				// 2 - Find fixed els outside viewport
				const outsideViewportFixedEls = fixedEls.filter(window._isItOutsideTopViewport);
				// 2.1 - fixed elements can still have things in a new drawing context, positioned above the fold -- check each descendant individually
				const jqFixedInsides = $(outsideViewportFixedEls).find(":visible");
				const jqVisibleFixedInsides = jqFixedInsides.filter((i, el)=>!window._isItOutsideTopViewport(el));
				elsToHide = jqFixedInsides.not(jqVisibleFixedInsides).add(outsideViewportFixedEls).toArray();
				elsToShow = jqVisibleFixedInsides.toArray();
				// 3 - Hide/Show
				if(elsToHide.length){
					console.log("[ALTER] Hiding fixed Nodes outside the viewport, n: ", outsideViewportFixedEls.length, location.href);
					outsideViewportFixedEls.forEach(el => console.log(window.__el2stringForDiagnostics(el)));
					elsToHide.forEach(el => cssInjctr._injectCss1Element(el, "", {"visibility": "hidden !important"}));
					// window.__setCSSPropJqArr(elsToHide, "visibility", "hidden", "important");
					if(elsToShow.length){
						elsToHide.forEach(el => cssInjctr._injectCss1Element(el, "", {"visibility": "visible"}));
						// window.__setCSSPropJqArr(elsToShow, "visibility", "visible", "important");
					}
				}
			},
			unhideInvisFixedEls(){
				cssInjctr._removeAllCss();
				// if(elsToHide && elsToShow){
				// 	window.__restoreCSSPropJqArr(elsToHide.concat(elsToShow), "visibility");
				// }
				// elsToHide = null;
				// elsToShow = null;
			}
		};
	})();
	
	const {removeNoScript, readdNoScript} = (()=>{
		// NOTE: these affect neighbour-based CSS -- too much hustle for too little benefit -- Abandon for now
		const noScriptStore = [];
		return {removeNoScript: ()=>{
			document.body.querySelectorAll("noscript").forEach((el, i) => {
				const aDiv = window.__makeInvisDiv();
				noScriptStore.push({noscript: el, div: aDiv});
				el.replaceWith(aDiv);
			});
			console.log("[MODDING] Removed noscripts");
		}, readdNoScript: ()=>{
			var pair;
			while(pair = noScriptStore.shift()){
				pair.div.replaceWith(pair.noscript);
			}
			console.log("[MODING] Reattached noscripts");
		}};
	})();


	//TODO: REPLACE these throughout the code
	// window._getVisibleElementsWithText = _getVisibleElementsWithText;
	// window._getVisibleElements = _getVisibleElements;
	// window._getCategorizedGraphics = _getCategorizedGraphics;


	//	window.__getSnapshotBox = __getSnapshotBox;
	//	window._checkZIndexVisibility = _checkZIndexVisibility; // NOTE: removed. It didn't work
	window._el2canvasWhiteBG = _el2canvasWhiteBG;
	// window._findOverlays = _findOverlays; // TODO: REMOVE elsewhere
	// window._findCoveringOverlays = _findCoveringOverlays;
	// window.prepDomForInstaManip = prepDomForInstaManip;
	// window.restoreDomFromInstaManip = restoreDomFromInstaManip;
	window._el2canvasWhiteBgNoOverlaysAsync = _el2canvasWhiteBgNoOverlaysAsync;
	window._el2canvasNoOverlaysAsync = _el2canvasNoOverlaysAsync;
	window._el2canvasNoOverlays = _el2canvasNoOverlays;
	window.__filterElementsNoParentMatch = __filterElementsNoParentMatch;
	window.__filterElements = __filterElements;
	window._tagSets = _tagSets;
	window.prepDomForDataExtractionAsync = prepDomForDataExtractionAsync;
	window.__are2colorsDiff = __are2colorsDiff; // TODO: move to Helper
	window.restoreDomAfterDataExtraction = restoreDomAfterDataExtraction;

	window.toggleDomPrepForInstaManip = createFToggleDomPrepForInstaManip();

	window.domGetters = {
		getTxtGr: jqG.getTxtGr,
		getAllVis: jqG.getAllVis,
		getOtherGrPromise: jqG.getOtherGrPromise,
		getCntrlGr: jqG.getCntrlGr,
		forceRefresh: jqG.forceRefresh,
		grNames: jqG.grNames,
		getSemanticGrPrms: jqG.getSemanticGrPrms,
		getGraphGrPromise: jqG.getGraphGrPromise,
		cleanOverlaysOutAsync: jqG.cleanOverlaysOutAsync
	};
	window.graphTypes = graphTypes;
	window.getGTypeArrAsync = graphObjStore.filterDownTo; // I regret having this F -- should've just exposed requestCatGraphObjArr directly
	window.requestCatGraphObjArr = graphObjStore.requestCatGraphObjArr;
	window._tagSets = _tagSets;

	window._getVisInnerTxt = _getVisInnerTxt;
	window.__isItUI = __isItUI;
})();
