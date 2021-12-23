/*eslint-env browser */

(function () {
	const bgStore = {}; // TODO: rewrite this mess - it's synchronous and should be simpler
	// we can't be asyncrous
	const MAX_PARALLEL_WORKERS = 1;

	function __strToInt(el) {
		var aRes = parseFloat(el.trim());
		if (isNaN(aRes)) {
			throw new Error("RGB pieces should be numbers, but the current piece is: ", el.toSource());
		}
		return aRes;
	}

	function __colorStrToInt(color) {
		const _origCol = color;
		color = color.replace(")", "");
		color = color.split(",");
		var isRgba = false;
		if (!(color[0].indexOf("rgb(") > -1 || color[0].indexOf("rgba(") > -1)) {
			// we don't deal with other situations
			console.error("Weird color: ", _origCol);
			return null;
		}
		color[0] = color[0].replace("rgb(", "").replace("rgba(", "");
		color = color.map(__strToInt);
		if (color.length > 3) {
			const transp = color[3];
			color = color.map(x => x * transp).map(Math.round);
		}
		return [color[0], color[1], color[2]];
	}

	function __getBgFromUrl(bbox, el, cb) {
		const canvas = window.screenPart2Canvas(bbox);
//		const canvas = window._el2canvasWhiteBG(el, bbox); // NO, for color pairings we should absolutely use the original set-up --> it's only when we screenshot images for later VC analyses that we should add white-gray bg
		const imgPix = canvas.getContext("2d").getImageData(0, 0, bbox.width, bbox.height).data;
		const avgRgb = window.__calAvgRGB(imgPix);
		return cb(avgRgb);
	}

//	const _getComputedStyle = window.getComputedStyle;

	function _getRgbColors(el, globcb) {
		const __getBgColorAndOpacity = function (el, cb) {
			try {
//				const elStyle = _getComputedStyle(el);
				const elStyle = window.getComputedStyle(el);
			} catch (e) {
				console.error("ERROR while processing element styles, el", el.toSource(), "ERROR", e);
				return undefined;
			}

			const result = {
				bgCol: [255, 255, 255],
				opacity: parseFloat(elStyle["opacity"])
			};
			const ___checkTheParent = function (el, cb) {
				if (el.tagName.toLowerCase() != "html") {
					// TODO remove if later
					if (!el.parentElement) {
						console.log("BAD parent for the element: ", el.toSource());
					}
					return __getBgColorAndOpacity(el.parentElement, cb);
				} else {
					result.opacity = 1;
					return cb(result);
				}
			};
			var bgColor = elStyle["backgroundColor"]; // "transparent"
			var bgImg = elStyle["backgroundImage"]; // none
			if (bgColor !== "transparent") {
				const bgColAsArr = __colorStrToInt(bgColor);
				if (bgColAsArr !== null) {
					result.bgCol = bgColAsArr;
					return cb(result);
				}
			}
			if (bgImg == "none") {
				return ___checkTheParent(el, cb);
			} else {
				if (bgStore[bgImg]) {
					result.bgCol = bgStore[bgImg];
					return cb(result);
				} else {
					// We'll have to deal with the image background...
					// 0 -  ensure the element is at least 1px wide/tall <-- Nope. Better get/set/enforce width and height.
					// const elW = elStyle["width"];
					// const elH = elStyle["height"];
					const bbox = window._getAbsBoundingRectAdjForParentOverflow(el);
//					const bbox = el.getBoundingClientRect();
//					const elCumulOffset = window._cumulativeOffset(el);
//					const elLeft = Math.floor(elCumulOffset.left);
//					const elTop = Math.floor(elCumulOffset.top);
//					if (elLeft < 0 || elTop < 0 || elLeft > document.documentElement.scrollWidth || elTop > document.documentElement.scrollHeight) {
//						console.error("Too BIG: ", el);
//					}
					// 1 - delete text from the element (temporarily)
					// NOTE: we don't use innerHTML -- it re-creates inner elements -- our pointers to those elements become obsolete
					// NOTE: we instead better make them invisible
					const elGuts = $(el).contents();
					if (!elGuts.length) {
						throw new Error("There should be child elements!");
					}
					elGuts.each(function (i, el) {
						const thisEl = $(this);
						if (this.nodeType === 3) {
							// text node
							this._textContent = this.textContent;
							// 1.1 -- We better replace with empty spaces than with Nothing...
							this.textContent = " ".repeat(this.textContent.length);
							// this.textContent = "";
						} else if (this.nodeType === 1) {
							// regular node
							thisEl.data("visdata", thisEl.css("visibility"));
							thisEl.css("visibility", "hidden");
						}
					});
					// 4 - calculate the average value
					// 4.b -- use a call to addon
					__getBgFromUrl(bbox, el, function (bgCol) {
						// 5 save the result
						result.bgCol = bgCol;
						bgStore[bgImg] = result.bgCol;
						// 6 restore the original text
						elGuts.each(function (i, el) {
							const thisEl = $(this);
							if (this.nodeType === 3) {
								// text node
								this.textContent = this._textContent;
								// this.textContent = thisEl.data("textdata");
							} else if (this.nodeType === 1) {
								// regular node
								thisEl.css("visibility", thisEl.data("visdata"));
							}
						});
						return cb(result);
					});
				}
			}
			// return result; 			
			return undefined;
		};
		// get the text color
		const elStyle = window.getComputedStyle(el);
		var elColor = __colorStrToInt(elStyle["color"]);
		if (elColor === null) {
			console.error("THE COLOR IS unknown -- switching to -1,-1,-1 Original color: ", elStyle["color"]);
			elColor = [-1, -1, -1];
		}
		// get background color -- recursive up till the bg isn't "transparent"
		__getBgColorAndOpacity(el, function (_bgAndOpacity) {
			var elBg = _bgAndOpacity.bgCol;
			elColor = elColor.map(function (item) {
				return item * _bgAndOpacity.opacity;
			});
			elBg = elBg.map(function (item) {
				return item * _bgAndOpacity.opacity;
			});
			return globcb({
				col: elColor,
				bg: elBg
			}, el);
		});
	}

	window._categorizeColorContrast = function (allTextLength, jqEls, globCb) {
		const resultContr = {};
		const resultDiff = {};
		const resultColBgPair = {};
		const _processColor = function (_c, jqEl) {
			const elColor = _c.col;
			const elFill = _c.bg;
			const _cpair = [elColor.join(","), elFill.join(",")].join("-");
			resultColBgPair[_cpair] || (resultColBgPair[_cpair] = []);
			resultColBgPair[_cpair].push(jqEl);
			// Step 2: convert RGB to Lab
			const elColorLab = window.rgbToLab(elColor);
			const elFillLab = window.rgbToLab(elFill);
			// Step 3: calc luminance contrast
			const MAXL = 100;
			var elContrast = ((Math.max(elColorLab[0], elFillLab[0]) / MAXL + 0.05) / (Math.min(elColorLab[0], elFillLab[0]) / MAXL + 0.05)).toFixed(3);
			elContrast = "contrast_" + elContrast;
			resultContr[elContrast] || (resultContr[elContrast] = []);
			resultContr[elContrast].push(jqEl);
			// Step 4: Euqlidian distance --- absolute values...
			var r = Math.pow(elColor[0] - elFill[0], 2);
			var g = Math.pow(elColor[1] - elFill[1], 2);
			var b = Math.pow(elColor[2] - elFill[2], 2);
			var elDist = Math.sqrt((r + g + b) / 3).toFixed(1);
			elDist = "colordist_" + elDist;
			resultDiff[elDist] || (resultDiff[elDist] = []);
			resultDiff[elDist].push(jqEl);
		};

		var syncObj = jqEls.length;
		jqEls = jqEls.toArray();
		for (var ithread = MAX_PARALLEL_WORKERS; ithread--;) {
			_workTheseElements(jqEls);
		}

		function _workTheseElements(jqEls) {
			if (jqEls.length) {
				// Step 1: extract the values in RGB
				_getRgbColors(jqEls.pop(), function (_c, jqEl) {
					syncObj--;
					_processColor(_c, jqEl);
					if (!syncObj) {
						globCb({
							jqElColorDiff: resultDiff,
							jqElLumContr: resultContr,
							jqElColBg: resultColBgPair
						});
					} else {
						_workTheseElements(jqEls);
					}
				});
			}
		}
		return undefined;
	};
})();
