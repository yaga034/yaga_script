function EffectController(thisObj) {
    // 初期値の定義
    var defaultValues = {
        amplitude: 20,
        frequency: 3,
        blend: 100,
        motionBlur: true
    };

    var presetValues = {
        handHeld: { amplitude: 3, frequency: 15 },
        action: { amplitude: 8, frequency: 40 }
    };

    // アクティブなレイヤーとその設定を保存するオブジェクト
    var activeLayerSettings = {};

    // パネル作成
    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Effect Controller");
    var win = panel;
    
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 5;
    win.margins = 10;

    // Preset Controls
    var presetGroup = win.add("panel", undefined, "Camera Shake Preset");
    presetGroup.orientation = "column";
    presetGroup.alignChildren = ["fill", "top"];
    presetGroup.spacing = 5;

    var presetButtonGroup = presetGroup.add("group");
    presetButtonGroup.orientation = "row";
    presetButtonGroup.alignChildren = ["center", "center"];
    var handHeldBtn = presetButtonGroup.add("button", undefined, "1.HandHeld");
    var actionBtn = presetButtonGroup.add("button", undefined, "2.Action");

    // Layer Selection
    var layerGroup = win.add("panel", undefined, "Active Layers");
    layerGroup.orientation = "column";
    layerGroup.alignChildren = ["fill", "top"];
    layerGroup.spacing = 5;

    var layerDropdown = layerGroup.add("dropdownlist");
    layerDropdown.size = [200, 25];
    
    var layerButtonGroup = layerGroup.add("group");
    layerButtonGroup.orientation = "row";
    layerButtonGroup.alignChildren = ["center", "center"];
    var addLayerBtn = layerButtonGroup.add("button", undefined, "Add Layer");
    var removeLayerBtn = layerButtonGroup.add("button", undefined, "Remove Layer");
    
    // Camera Shake Controls
    var shakeGroup = win.add("panel", undefined, "Camera Shake");
    shakeGroup.orientation = "column";
    shakeGroup.alignChildren = ["fill", "top"];
    shakeGroup.spacing = 5;
    
    var ampGroup = shakeGroup.add("group");
    ampGroup.add("statictext", undefined, "Amplitude:");
    var ampSlider = ampGroup.add("slider", undefined, defaultValues.amplitude, 0, 100);
    ampSlider.size = [150, 20];
    var ampText = ampGroup.add("edittext", undefined, defaultValues.amplitude.toString());
    ampText.characters = 4;
    var ampKeyBtn = ampGroup.add("button", undefined, "Key");
    
    var freqGroup = shakeGroup.add("group");
    freqGroup.add("statictext", undefined, "Frequency:");
    var freqSlider = freqGroup.add("slider", undefined, defaultValues.frequency, 0, 100);
    freqSlider.size = [150, 20];
    var freqText = freqGroup.add("edittext", undefined, defaultValues.frequency.toString());
    freqText.characters = 4;
    var freqKeyBtn = freqGroup.add("button", undefined, "Key");

    var shakeResetBtn = shakeGroup.add("button", undefined, "Reset Shake");
    
    // Motion Blur Controls
    var blurGroup = win.add("panel", undefined, "Motion Blur");
    blurGroup.orientation = "column";
    blurGroup.alignChildren = ["fill", "top"];
    blurGroup.spacing = 5;
    
    var blurCheckbox = blurGroup.add("checkbox", undefined, "Enable Motion Blur");
    blurCheckbox.value = true;
    
    // Blend Controls
    var blendGroup = win.add("panel", undefined, "Blend");
    blendGroup.orientation = "column";
    blendGroup.alignChildren = ["fill", "top"];
    blendGroup.spacing = 5;
    
    var blendControl = blendGroup.add("group");
    blendControl.add("statictext", undefined, "Amount:");
    var blendSlider = blendControl.add("slider", undefined, defaultValues.blend, 0, 100);
    blendSlider.size = [150, 20];
    var blendText = blendControl.add("edittext", undefined, defaultValues.blend.toString());
    blendText.characters = 4;
    var blendKeyBtn = blendControl.add("button", undefined, "Key");

    var blendResetBtn = blendGroup.add("button", undefined, "Reset Blend");

    // Reset All button
    var resetAllBtn = win.add("button", undefined, "Reset All");

    // ユーティリティ関数
    function clampValue(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getActiveComp() {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) {
            return null;
        }
        return comp;
    }

    function getSliderPropertyName() {
        try {
            var comp = app.project.activeItem;
            if (comp && comp.layer(1)) {
                var testEffect = comp.layer(1).Effects.addProperty("ADBE Slider Control");
                var propertyName = testEffect.property(1).name;
                comp.layer(1).Effects.remove(testEffect);
                return propertyName;
            }
        } catch (err) {}
        return "Slider";
    }

    function getOrCreateEffectSlider(layer, name, defaultValue) {
        var effect = layer.property("ADBE Effect Parade").property(name);
        if (!effect) {
            effect = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            effect.name = name;
            effect.property(1).setValue(defaultValue);
        }
        return effect.property(1);
    }

    function generateWiggleExpression() {
        return [
            "try {",
            "    var amp = effect('Amplitude')(1);",
            "    var freq = effect('Frequency')(1);",
            "    var blend = effect('Blend')(1);",
            "    var original = value;",
            "    var result = wiggle(freq, amp);",
            "    (blend <= 0) ? original : original + ((result - original) * (blend/100));",
            "} catch(err) {",
            "    value;",
            "}"
        ].join("\n");
    }
    
    function setKeyframeAtCurrentTime(property, value) {
        if (!app.project.activeItem) return;
        var currentTime = app.project.activeItem.time;
        property.setValueAtTime(currentTime, value);
    }

    function isLayerActive(layer) {
        try {
            var positionProp = layer.property("ADBE Transform Group").property("ADBE Position");
            return positionProp.expression !== "";
        } catch (err) {
            return false;
        }
    }

    // メイン機能関数
    function updateActiveLayerList() {
        if (!app.project || !app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            return;
        }

        var comp = app.project.activeItem;
        layerDropdown.removeAll();

        for (var id in activeLayerSettings) {
            try {
                comp.layer(parseInt(id));
            } catch (err) {
                delete activeLayerSettings[id];
            }
        }

        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            if (activeLayerSettings[i] || isLayerActive(layer)) {
                layerDropdown.add("item", i + ": " + layer.name);
                if (!activeLayerSettings[i]) {
                    activeLayerSettings[i] = {
                        amplitude: defaultValues.amplitude,
                        frequency: defaultValues.frequency,
                        blend: defaultValues.blend,
                        motionBlur: defaultValues.motionBlur
                    };
                }
            }
        }

        if (layerDropdown.items.length > 0) {
            layerDropdown.selection = 0;
            loadLayerSettings(parseInt(layerDropdown.selection.text));
        }

        updateMotionBlurState();
    }

    function updateMotionBlurState() {
        if (!layerDropdown.selection) return;
        
        var layerIndex = parseInt(layerDropdown.selection.text);
        var comp = app.project.activeItem;
        if (!comp) return;
        
        try {
            var layer = comp.layer(layerIndex);
            if (layer && layer.motionBlur !== undefined) {
                blurCheckbox.value = layer.motionBlur;
            }
        } catch (err) {}
    }

    function applyPreset(presetType) {
        var comp = getActiveComp();
        if (!comp) {
            alert("Please select a composition");
            return;
        }

        var sliderName = getSliderPropertyName();
        app.beginUndoGroup("Apply Camera Shake Preset");
        
        try {
            var nullLayer = comp.layers.addNull();
            nullLayer.name = "Camera Shake Controller";
            nullLayer.name = presetType === 'handHeld' ? "HandHeld_Null" : "Action_Null";
            nullLayer.moveToBeginning();
            nullLayer.motionBlur = true;
            nullLayer.motionBlurPhase = 360;

            var presetValue = presetValues[presetType];
            
            var ampEffect = nullLayer.Effects.addProperty("ADBE Slider Control");
            ampEffect.name = "Amplitude";
            ampEffect.property(1).setValue(presetValue.amplitude);

            var freqEffect = nullLayer.Effects.addProperty("ADBE Slider Control");
            freqEffect.name = "Frequency";
            freqEffect.property(1).setValue(presetValue.frequency);

            var blendEffect = nullLayer.Effects.addProperty("ADBE Slider Control");
            blendEffect.name = "Blend";
            blendEffect.property(1).setValue(defaultValues.blend);

            var positionProp = nullLayer.property("ADBE Transform Group").property("ADBE Position");
            positionProp.expression = generateWiggleExpression(sliderName);

            for (var i = 1; i <= comp.numLayers; i++) {
                var layer = comp.layer(i);
                if (layer !== nullLayer) {
                    layer.motionBlur = true;
                    layer.parent = nullLayer;
                }
            }

            activeLayerSettings[nullLayer.index] = {
                amplitude: presetValue.amplitude,
                frequency: presetValue.frequency,
                blend: defaultValues.blend,
                motionBlur: true
            };

            updateActiveLayerList();

        } catch (err) {
            alert("Error: " + err.toString());
        }

        positionProp.expression = generateWiggleExpression();
        
        app.endUndoGroup();
    }

    function addNewLayer() {
        var comp = getActiveComp();
        if (!comp) {
            alert("Please select a composition");
            return;
        }
    
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            alert("Please select at least one layer");
            return;
        }
    
        app.beginUndoGroup("Add Layers to Camera Shake");
        
        try {
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                
                // 既存のエフェクトを確認し、必要な場合のみ追加
                var effects = layer.property("ADBE Effect Parade");
                
                if (!effects.property("Amplitude")) {
                    var ampEffect = effects.addProperty("ADBE Slider Control");
                    ampEffect.name = "Amplitude";
                    ampEffect.property(1).setValue(defaultValues.amplitude);
                }
    
                if (!effects.property("Frequency")) {
                    var freqEffect = effects.addProperty("ADBE Slider Control");
                    freqEffect.name = "Frequency";
                    freqEffect.property(1).setValue(defaultValues.frequency);
                }
    
                if (!effects.property("Blend")) {
                    var blendEffect = effects.addProperty("ADBE Slider Control");
                    blendEffect.name = "Blend";
                    blendEffect.property(1).setValue(defaultValues.blend);
                }
    
                layer.motionBlurPhase = 360;
                var positionProp = layer.property("ADBE Transform Group").property("ADBE Position");
                positionProp.expression = generateWiggleExpression();
    
                activeLayerSettings[layer.index] = {
                    amplitude: defaultValues.amplitude,
                    frequency: defaultValues.frequency,
                    blend: defaultValues.blend,
                    motionBlur: defaultValues.motionBlur
                };
            }
    
            updateActiveLayerList();
    
        } catch (err) {
            alert("Error: " + err.toString());
        }
        
        app.endUndoGroup();
    }

    function removeActiveLayer() {
        if (!layerDropdown.selection) return;
    
        app.beginUndoGroup("Remove Layer from Camera Shake");
    
        try {
            var layerIndex = parseInt(layerDropdown.selection.text);
            var comp = app.project.activeItem;
            var layer = comp.layer(layerIndex);
    
            if (layer) {
                var effects = layer.Effects;
                var effectsToRemove = ["Amplitude", "Frequency", "Blend"];
                
                for (var i = effects.numProperties; i >= 1; i--) {
                    var effect = effects.property(i);
                    for (var j = 0; j < effectsToRemove.length; j++) {
                        if (effect.name === effectsToRemove[j]) {
                            effects.property(i).remove();
                            break;
                        }
                    }
                }
    
                var positionProp = layer.property("ADBE Transform Group").property("ADBE Position");
                if (positionProp) {
                    positionProp.expression = "";
                }
                
                delete activeLayerSettings[layerIndex];
            }
    
        } catch (err) {
            alert("Error removing effects: " + err.toString());
        }
    
        app.endUndoGroup();
        updateActiveLayerList();
    }

    function saveLayerSettings(layerId) {
        if (!layerId || !activeLayerSettings[layerId]) return;
        
        activeLayerSettings[layerId] = {
            amplitude: ampSlider.value,
            frequency: freqSlider.value,
            blend: blendSlider.value,
            motionBlur: blurCheckbox.value
        };
    }

    function loadLayerSettings(layerId) {
        if (!layerId || !activeLayerSettings[layerId]) {
            resetControls("all");
            return;
        }

        var settings = activeLayerSettings[layerId];
        ampSlider.value = settings.amplitude;
        ampText.text = settings.amplitude.toString();
        freqSlider.value = settings.frequency;
        freqText.text = settings.frequency.toString();
        blendSlider.value = settings.blend;
        blendText.text = settings.blend.toString();
        blurCheckbox.value = settings.motionBlur;
    }

    function applyEffects(isNewEffect) {
        if (!app.project || !app.project.activeItem) return;
        
        app.beginUndoGroup("Apply Effects");
        
        try {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem)) {
                if (isNewEffect) alert("Please select a composition");
                return;
            }
    
            if (!layerDropdown.selection) {
                if (isNewEffect) alert("Please select a layer");
                return;
            }
    
            var layerIndex = parseInt(layerDropdown.selection.text);
            var layer = comp.layer(layerIndex);
            
            if (!layer) {
                if (isNewEffect) alert("Layer not found");
                return;
            }
    
            saveLayerSettings(layerIndex);
    
            if (layer.motionBlur !== undefined) {
                layer.motionBlur = blurCheckbox.value;
            }
    
            // エフェクトの値だけを更新
            var effects = layer.property("ADBE Effect Parade");
            if (effects.property("Amplitude")) effects.property("Amplitude")(1).setValue(ampSlider.value);
            if (effects.property("Frequency")) effects.property("Frequency")(1).setValue(freqSlider.value);
            if (effects.property("Blend")) effects.property("Blend")(1).setValue(blendSlider.value);
    
        } catch (err) {
            if (isNewEffect) {
                alert("Error: " + err.toString());
            }
        }
    
        app.endUndoGroup();
    }
    
        function resetControls(controlType) {
            if (!layerDropdown.selection) return;
            
            var layerIndex = parseInt(layerDropdown.selection.text);
            var layer = app.project.activeItem.layer(layerIndex);
            
            function removeKeyframes(effectName) {
                var effect = layer.property("ADBE Effect Parade").property(effectName);
                if (effect) {
                    var slider = effect.property(1);
                    if (slider.numKeys > 0) {
                        for (var i = slider.numKeys; i > 0; i--) {
                            slider.removeKey(i);
                        }
                    }
                }
            }
        
            switch(controlType) {
                case "shake":
                    ampSlider.value = defaultValues.amplitude;
                    ampText.text = defaultValues.amplitude.toString();
                    freqSlider.value = defaultValues.frequency;
                    freqText.text = defaultValues.frequency.toString();
                    removeKeyframes("Amplitude");
                    removeKeyframes("Frequency");
                    break;
                case "blur":
                    blurCheckbox.value = defaultValues.motionBlur;
                    break;
                case "blend":
                    blendSlider.value = defaultValues.blend;
                    blendText.text = defaultValues.blend.toString();
                    removeKeyframes("Blend");
                    break;
                case "all":
                    resetControls("shake");
                    resetControls("blur");
                    resetControls("blend");
                    break;
            }
            
            if (layerDropdown.selection) {
                applyEffects(false);
            }
        }
    
        // Event Listeners
        function addSliderListeners(slider, text, min, max) {
            slider.onChanging = function() { 
                var value = clampValue(Math.round(slider.value), min, max);
                text.text = value;
                slider.value = value;
                applyEffects(false);
            }
            text.onChange = function() {
                var val = parseFloat(text.text);
                if (!isNaN(val)) {
                    val = clampValue(Math.round(val), min, max);
                    slider.value = val;
                    text.text = val.toString();
                    applyEffects(false);
                }
            }
        }
    
        // Add slider listeners
        addSliderListeners(ampSlider, ampText, 0, 100);
        addSliderListeners(freqSlider, freqText, 0, 100);
        addSliderListeners(blendSlider, blendText, 0, 100);
    
        // Layer selection change listener
        layerDropdown.onChange = function() {
            if (layerDropdown.selection) {
                var layerIndex = parseInt(layerDropdown.selection.text);
                loadLayerSettings(layerIndex);
                updateMotionBlurState();
            }
        };
    
        // Motion blur checkbox listener
        blurCheckbox.onClick = function() {
            applyEffects(false);
        };
    
        // Reset button listeners
        shakeResetBtn.onClick = function() { resetControls("shake"); };
        blendResetBtn.onClick = function() { resetControls("blend"); };
        resetAllBtn.onClick = function() { resetControls("all"); };
    
        // Keyframe button listeners
        ampKeyBtn.onClick = function() {
            if (layerDropdown.selection) {
                var layerIndex = parseInt(layerDropdown.selection.text);
                var layer = app.project.activeItem.layer(layerIndex);
                var prop = getOrCreateEffectSlider(layer, "Amplitude", ampSlider.value);
                setKeyframeAtCurrentTime(prop, ampSlider.value);
            }
        };
        
        freqKeyBtn.onClick = function() {
            if (layerDropdown.selection) {
                var layerIndex = parseInt(layerDropdown.selection.text);
                var layer = app.project.activeItem.layer(layerIndex);
                var prop = getOrCreateEffectSlider(layer, "Frequency", freqSlider.value);
                setKeyframeAtCurrentTime(prop, freqSlider.value);
            }
        };
        
        blendKeyBtn.onClick = function() {
            if (layerDropdown.selection) {
                var layerIndex = parseInt(layerDropdown.selection.text);
                var layer = app.project.activeItem.layer(layerIndex);
                var prop = getOrCreateEffectSlider(layer, "Blend", blendSlider.value);
                setKeyframeAtCurrentTime(prop, blendSlider.value);
            }
        };
    
        // Preset button listeners
        handHeldBtn.onClick = function() { applyPreset('handHeld'); };
        actionBtn.onClick = function() { applyPreset('action'); };
        
        // Add/Remove Layer button listeners
        addLayerBtn.onClick = addNewLayer;
        removeLayerBtn.onClick = removeActiveLayer;
    
        // Initial update
        updateActiveLayerList();
    
        // Show panel
        if (panel instanceof Window) {
            panel.center();
            panel.show();
        } else {
            panel.layout.layout(true);
        }
    }
    
    EffectController(this);