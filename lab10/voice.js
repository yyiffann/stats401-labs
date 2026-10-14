/* Input handling is independent of Lab 9's rendering and linked highlighting. */
(() => {
    'use strict';
    const byId = id => document.getElementById(id);
    const start = byId('voice-start'), stop = byId('voice-stop');
    const menu = byId('country-select');
    const status = text => { byId('voice-status').textContent = text; };
    const action = text => { byId('action-status').textContent = `Action: ${text}`; };
    const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    let ready = false, active = false, recognition = null, hasOutcome = false, cancelled = false;
    const names = new Map();
    function highlight(iso) {
        const country = window.lab10Map.highlight(iso);
        menu.value = iso;
        action(`Highlighted ${country.name}${country.hasGDP ? ' in both maps.' : ' on the choropleth; GDP is unavailable, so there is no sized cartogram mark.'}`);
    }
    function reset() {
        window.lab10Map.reset();
        menu.value = '';
        action('Selection cleared; both map views reset.');
    }
    function handleCommand(transcript) {
        if (!ready) { action('Maps are not ready yet.'); return; }
        const command = normalize(transcript);
        if (command === 'reset' || command === 'reset maps') { reset(); return; }
        const match = command.match(/^(?:show|highlight|select) (.+)$/);
        const iso = match && names.get(match[1]);
        if (iso) highlight(iso);
        else action('Command not recognized. Try “Show China”, “Highlight Japan”, or “Reset”. Selection unchanged.');
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Recognition) {
        try { recognition = new Recognition(); }
        catch (_) { status('Speech recognition unavailable. Use the country menu or map clicks.'); }
    } else status('Speech recognition is not supported in this browser. Use the country menu or map clicks.');
    function buttons() {
        start.disabled = !ready || !recognition || active;
        stop.disabled = !active;
    }
    if (recognition) {
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onstart = () => { if (!cancelled) status('Listening… Say one command.'); };
        recognition.onresult = event => {
            if (cancelled) return;
            const transcript = event.results[event.resultIndex || 0][0].transcript;
            hasOutcome = true;
            byId('voice-heard').textContent = `Heard: “${transcript}”`;
            handleCommand(transcript);
            status('Command received. Waiting for recognition to finish…');
        };
        recognition.onnomatch = () => {
            if (cancelled) return;
            hasOutcome = true;
            status('Speech could not be recognized. Try again or use the country menu.');
        };
        recognition.onerror = event => {
            if (cancelled) return;
            hasOutcome = true;
            const errors = {
                'not-allowed': 'Microphone permission denied. Allow access in browser settings or use the country menu.',
                'service-not-allowed': 'Speech service unavailable or blocked. Use the country menu.',
                'audio-capture': 'No microphone is available. Check your microphone or use the country menu.',
                'no-speech': 'No speech detected. Click Start and try again.',
                'network': 'Speech service network error. Check your connection or use the country menu.',
                'aborted': 'Listening cancelled.'
            };
            status(errors[event.error] || `Speech recognition error: ${event.error}. Use the country menu.`);
        };
        recognition.onend = () => {
            active = false;
            buttons();
            if (cancelled) status('Listening cancelled. Click Start to try again.');
            else if (!hasOutcome) status('No command received. Click Start to try again.');
            else if (byId('voice-status').textContent.startsWith('Command received')) status('Voice control inactive. Click Start for another command.');
        };
    }
    start.addEventListener('click', () => {
        if (!ready || !recognition || active) return;
        active = true; cancelled = false; hasOutcome = false;
        buttons();
        byId('voice-heard').textContent = 'Heard: —';
        status('Starting… Allow microphone access if prompted.');
        try { recognition.start(); }
        catch (error) { active = false; buttons(); status(`Could not start speech recognition (${error.name}). Try again or use the country menu.`); }
    });
    stop.addEventListener('click', () => {
        if (!active) return;
        cancelled = true;
        status('Cancelling…');
        recognition.abort();
    });
    window.addEventListener('pagehide', () => { if (active) { cancelled = true; recognition.abort(); } });
    byId('reset-all').addEventListener('click', reset);
    byId('country-show').addEventListener('click', () => {
        if (menu.value) highlight(menu.value);
        else action('Choose a country first.');
    });
    window.addEventListener('lab10-ready', () => {
        const countries = window.lab10Map.countries().sort((a, b) => a.name.localeCompare(b.name));
        for (const country of countries) {
            names.set(normalize(country.name), country.iso);
            names.set(normalize(country.iso), country.iso);
            menu.add(new Option(country.name, country.iso));
        }
        const aliases = { 'united states of america': 'USA', 'us': 'USA', 'u s': 'USA',
            'u s a': 'USA', 'uk': 'GBR', 'u k': 'GBR', 'britain': 'GBR', 'russia': 'RUS',
            'south korea': 'KOR', 'korea': 'KOR', 'turkey': 'TUR', 'vietnam': 'VNM',
            'iran': 'IRN', 'czechia': 'CZE', 'uae': 'ARE', 'hong kong': 'HKG' };
        for (const [name, iso] of Object.entries(aliases)) {
            if (countries.some(d => d.iso === iso)) names.set(name, iso);
        }
        ready = true;
        menu.disabled = false;
        byId('country-show').disabled = false;
        byId('reset-all').disabled = false;
        byId('map-status').textContent = 'Maps ready. Select a country to compare the two views.';
        buttons();
    }, { once: true });
})();