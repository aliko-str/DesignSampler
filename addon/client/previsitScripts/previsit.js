/* eslint-env browser */

// TODO: 5) Copy/replace DOM before screenshotting - so all animations stop

(function () {
	const scriptLoadedTimeout = 12000;
	const delayFromScriptsToRun = 2500;
	var hasLoaded = false;

	function scrollDownUp(cb) {
		const scrlEl = window.getScrlEl();//window.getScrlEl() || document.documentElement;
		console.log("Current scroll: ", window.scrollY, " Window height: ", scrlEl.scrollHeight);
		if (window.scrollY < (scrlEl.scrollHeight - window.innerHeight)) {
			window.scrollTo(0, window.scrollY + window.innerHeight);
			window.setTimeout(function () {
				scrollDownUp(cb);
			}, 150);
		} else {
			window.scrollTo(0, 0);
			console.log("Scrolled back up");
			cb();
		}
	}
	
	function waitForAllImagesToLoad(callback) {
		console.log("WAITING FOR ALL IMAGES");
		const element = document.body;
		var allImgsLength = 0;
		var allImgsLoaded = 0;
		var allImgs = [];

		var filtered = Array.prototype.filter.call(element.querySelectorAll('img'), function (item) {
			if (item.src === '') {
				return false;
			}

			// Firefox's `complete` property will always be `true` even if the image has not been downloaded.
			// Doing it this way works in Firefox.
			var img = new Image();
			img.src = item.src;
			return !img.complete;
		});

		allImgs = filtered.map(item => ({
			src: item.src,
			element: item
		}));

		allImgsLength = allImgs.length;
		allImgsLoaded = 0;

		// If no images found, don't bother.
		if (allImgsLength === 0) {
			callback.call(element);
		}

		console.log("Images to load", allImgs.length, JSON.stringify(allImgs));

		allImgs.forEach(function (img) {
			var image = new Image();

			// Handle the image loading and error with the same callback.
			image.addEventListener('load', function () {
				allImgsLoaded++;
				console.log("Loaded an image");
				if (allImgsLoaded === allImgsLength) {
					callback.call(element);
					return false;
				}
			});

			image.addEventListener('error', function () {
				allImgsLoaded++;
				console.log("Error loading an image");
				if (allImgsLoaded === allImgsLength) {
					callback.call(element);
					return false;
				}
			});

			image.src = img.src;
		});
	};

	function unloadTimeouts() {
		// TODO: switch to load.control.js -- duplicate functionality
		const subF = function (w) {
			// NOTE: This may not work at all because FF doesn't give the same DOM objects to our Content Scripts --> Try cloning DOM instead
			const highestTimeoutId = w.setTimeout(";");
			for (let i = 0; i < highestTimeoutId; i++) {
				w.clearTimeout(i);
			}
			const highestIntervalId = w.setInterval(";");
			for (let i = 0; i < highestIntervalId; i++) {
				w.clearInterval(i);
			}
		};
		subF(window);
		console.log("unloadTimeouts has finished for the main window");
		// NO point doing this unloading -- we automatically load the same load-control scripts for iframes as during the main phase
		window.stop();
	};

	var _hasRun = false;

	function startWorkingOnPage() {
		if (_hasRun) {
			return;
		}
		_hasRun = true;
		window.setTimeout(function () {
			window.addEventListener("message", function (event) {
				if (event.source === window && event.data && event.data.type === "page.script.loaded") {
					if(!hasLoaded){
						hasLoaded = true;
						// we're done detaching timeouts and intervals ==> do other work
						window.__ssGenericPageMod(); // so we don't redo the work of deleting common banners
						window.renderFormAndAssignHandlers();
						// TODO notify parent script all good
					}
				}
			});
			var scriptEl = document.createElement("script");
			const fDeclaration = unloadTimeouts + ";";
			const scriptText = "unloadTimeouts();window.postMessage({'type': 'page.script.loaded'});";
			scriptEl.text = fDeclaration + scriptText;
			document.head.appendChild(scriptEl);
			// some extras - pausing video/audio
			window.pauseVideoAudio();

			window.setTimeout(function () {
				if (!hasLoaded) {
					hasLoaded = true;
					console.error("After double waiting period of scriptLoadedTimeout, ", scriptLoadedTimeout, "Not everything has loaded/fired ");
					// TODO rest of work
					window.renderFormAndAssignHandlers();
					// self.port.emit("script.loaded", hasLoaded);
				}
			}, scriptLoadedTimeout);
		}, delayFromScriptsToRun);
	}
	// Non-declaration code below -- actual work
	scrollDownUp(()=>{
		if (document.readyState === "complete") {
			waitForAllImagesToLoad(startWorkingOnPage);
		} else {
			window.addEventListener("load", x => waitForAllImagesToLoad(startWorkingOnPage));
		}
	});
	// for the case when "load" is overwritten or fails to fire for any other reason
	window.setTimeout(function () {
		if (!_hasRun) {
			if (console && console.log) {
				console.log("Timed out on: " + window.location.href);
			}
			// here we don't care if images haven't loaded fully yet -- too much to wait
			startWorkingOnPage();
		}
	}, scriptLoadedTimeout);

})();
