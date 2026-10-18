'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const ids = ['concept','ratio','placement','framing','background','backgroundCustom','outfit','outfitColor','outfitDetail','hair','hairColor','accessories','hand','posture','gaze','expression','lighting','extra'];
  const fields = Object.fromEntries(ids.map(id => [id, $(id)]));
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const draftKey = 'femanail-hero-draft-v1';
  let reference = null;
  let referenceUrl = null;
  let selectedTab = 'json';
  let outputs = {};
  const value = id => fields[id].value.trim();
  const tilt = () => document.querySelector('input[name="tilt"]:checked').value;
  const setStatus = message => { $('heroStatus').textContent = message; };
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const box = document.createElement('textarea'); box.value = text; document.body.append(box); box.select(); document.execCommand('copy'); box.remove();
    }
  };
  const build = () => {
    const transparent = value('background') === 'Transparent cutout';
    const scene = value('background') === 'Custom' ? (value('backgroundCustom') || 'Custom scene, to be specified') : value('background');
    const side = tilt();
    const lean = side === 'center' ? 'Upright and centered; no lateral head or torso tilt' : `Gentle head and upper-body tilt toward the viewer’s ${side}; keep anatomy natural`;
    const prompt = {
      schema_version: '1.0',
      task: 'Create one polished, photorealistic website hero banner image',
      website: { concept: value('concept') || 'Professional website homepage', purpose: 'Hero image with clear visual hierarchy and usable space for website headline and buttons', aspect_ratio: value('ratio'), subject_placement: value('placement'), framing: value('framing'), text_instruction: 'Do not render headline, buttons, UI, logos, or words in the image; site text will be placed separately in HTML', safe_area: 'Keep the empty side clean and uncluttered; do not crop the face, hands, or important clothing details' },
      reference_image: reference ? { filename: reference.name, attach_original_file_with_prompt: true, use_as_primary_identity_reference: true, preserve_facial_proportions: true, preserve_age_and_skin_tone: true, preserve_natural_skin_texture: true, note: 'The image bytes are not included in this text export.' } : { attached: false, note: 'For identity preservation, attach an original reference photo alongside this prompt.' },
      subject: { description: 'One realistic human subject appropriate to the website concept', expression: value('expression') || 'Warm, natural expression', gaze: value('gaze'), skin_and_anatomy: 'Realistic pores, natural facial proportions, believable hands and fingers' },
      wardrobe: { outfit_style: value('outfit') || 'Professional outfit suited to the website concept', outfit_color: value('outfitColor') || 'Color coordinated with the website palette', fabric_graphic_and_details: value('outfitDetail') || 'Realistic fabric texture and garment construction', accessories_and_makeup: value('accessories') || 'Tasteful, minimal styling' },
      hair: { style: value('hair') || 'Natural, polished hairstyle', color_and_details: value('hairColor') || 'Natural hair color and individual strands' },
      pose: { body_posture: value('posture') || 'Relaxed, confident upper-body posture', hand_position: value('hand') || 'Hands relaxed and anatomically natural', tilt_direction_viewer_perspective: side, tilt_instruction: lean, shoulders: 'Relaxed and anatomically believable' },
      scene: { background: scene, custom_direction: value('backgroundCustom') || null, transparency: transparent ? 'Request genuine alpha transparency in PNG if supported; no white fill, checkerboard pattern, or hair halo' : 'Opaque background with subject separation', lighting: value('lighting'), color_accuracy: 'Natural skin tones and accurate garment colors' },
      output: { format: transparent ? 'PNG with alpha transparency if the generator supports it' : 'High-quality PNG or JPEG', aspect_ratio: value('ratio'), quality: 'High-resolution, crisp, photorealistic', composition: 'Designed to crop cleanly on desktop and mobile without losing the face or hands', extra_direction: value('extra') || null },
      avoid: ['Changed identity when a reference is attached','Plastic skin or excessive retouching','Extra fingers or distorted hands','Distorted clothing or accessories','Unnatural pose or exaggerated tilt','Text, watermark, logo, or fake website UI',...(transparent ? ['White background instead of transparency','Fake checkerboard transparency','White halo around hair or garment'] : [])]
    };
    const prose = `${reference ? `Attach the reference photo named ${reference.name}. Preserve this person’s face, age, skin tone, and natural skin texture. ` : 'If an exact person is needed, attach a reference photo with this prompt. '}Create one photorealistic website hero banner for ${prompt.website.concept}. Use a ${value('ratio')} canvas with ${value('framing').toLowerCase()}. Place the subject ${value('placement').toLowerCase()} and leave clean space for website copy and buttons. Outfit: ${prompt.wardrobe.outfit_style}; color: ${prompt.wardrobe.outfit_color}; detail: ${prompt.wardrobe.fabric_graphic_and_details}. Hair: ${prompt.hair.style}; ${prompt.hair.color_and_details}. Hands: ${prompt.pose.hand_position}. Posture: ${prompt.pose.body_posture}. ${lean}. Gaze: ${prompt.subject.gaze}. Expression: ${prompt.subject.expression}. Accessories and makeup: ${prompt.wardrobe.accessories_and_makeup}. Background: ${scene}${value('backgroundCustom') && value('background') !== 'Custom' ? `, ${value('backgroundCustom')}` : ''}. Lighting: ${value('lighting')}. ${transparent ? 'Request a real transparent PNG with clean hair and clothing edges if supported. ' : ''}${value('extra') ? `Extra direction: ${value('extra')}. ` : ''}Keep anatomy natural, colors accurate, and image free of text, logos, watermarks, and interface elements.`;
    const shortcode = [
      `/hero-banner ${value('ratio')}`,
      `Concept: ${prompt.website.concept}`,
      `Placement: ${value('placement')}`,
      `Framing: ${value('framing')}`,
      `Outfit: ${prompt.wardrobe.outfit_style}, ${prompt.wardrobe.outfit_color}`,
      value('outfitDetail') && `Outfit detail: ${value('outfitDetail')}`,
      `Hair: ${prompt.hair.style}${value('hairColor') ? `, ${value('hairColor')}` : ''}`,
      `Hands: ${prompt.pose.hand_position}`,
      `Posture: ${prompt.pose.body_posture}; tilt ${side} (viewer perspective)`,
      `Gaze: ${value('gaze')}`,
      `Expression: ${prompt.subject.expression}`,
      value('accessories') && `Accessories and makeup: ${value('accessories')}`,
      `Background: ${scene}${value('backgroundCustom') && value('background') !== 'Custom' ? `, ${value('backgroundCustom')}` : ''}`,
      `Lighting: ${value('lighting')}`,
      transparent && 'Output: genuine transparent PNG if supported; clean hair edges',
      reference && `Reference: attach ${reference.name}; preserve identity and natural skin texture`,
      value('extra') && `Extra: ${value('extra')}`,
      'Leave space for website text; no rendered words, logos, or watermark'
    ].filter(Boolean).join(' | ');
    return { json: JSON.stringify(prompt, null, 2), shortcode, chatgpt: `Create an image using this brief:\n\n${prose}`, gemini: `Generate one image from the following creative brief:\n\n${prose}` };
  };
  const render = () => { outputs = build(); $('heroOutput').textContent = outputs[selectedTab]; };
  const saveDraft = () => {
    const data = Object.fromEntries(ids.map(id => [id, fields[id].value])); data.tilt = tilt();
    try { localStorage.setItem(draftKey, JSON.stringify(data)); } catch { /* storage may be unavailable */ }
  };
  const updateGuide = () => {
    const [w,h] = value('ratio').split(':').map(Number); $('composition').style.aspectRatio = `${w}/${h}`; $('previewRatio').textContent = value('ratio');
    const guide = $('composition'); guide.className = 'hero-composition';
    if (value('background') === 'Transparent cutout') guide.classList.add('transparent');
    if (value('placement').startsWith('Left')) guide.classList.add('subject-left');
    if (value('placement').startsWith('Center')) guide.classList.add('subject-center');
    $('heroPerson').style.transform = `rotate(${tilt() === 'left' ? -7 : tilt() === 'right' ? 7 : 0}deg)`;
  };
  const refresh = () => { updateGuide(); render(); saveDraft(); };
  for (const [preset, field] of [['outfitPreset','outfit'],['colorPreset','outfitColor'],['hairPreset','hair'],['handPreset','hand'],['posturePreset','posture']]) {
    $(preset).addEventListener('change', () => { if ($(preset).value) { fields[field].value = $(preset).value; refresh(); } });
  }
  for (const field of Object.values(fields)) { field.addEventListener('input', refresh); field.addEventListener('change', refresh); }
  document.querySelectorAll('input[name="tilt"]').forEach(input => input.addEventListener('change', refresh));
  $('reference').addEventListener('change', event => {
    const file = event.target.files[0]; if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10*1024*1024) { event.target.value = ''; setStatus('Choose a JPG, PNG, or WebP under 10 MB.'); return; }
    if (referenceUrl) URL.revokeObjectURL(referenceUrl); reference = file; referenceUrl = URL.createObjectURL(file);
    $('referencePreview').src = referenceUrl; $('referenceName').textContent = file.name; $('referenceWrap').hidden = false;
    $('heroPerson').style.backgroundImage = `url("${referenceUrl}")`; $('heroPerson').classList.add('has-photo'); setStatus('Reference ready. Attach it again in your image tool.'); refresh();
  });
  $('removeReference').addEventListener('click', () => { if (referenceUrl) URL.revokeObjectURL(referenceUrl); referenceUrl = null; reference = null; $('reference').value = ''; $('referenceWrap').hidden = true; $('heroPerson').style.backgroundImage = ''; $('heroPerson').classList.remove('has-photo'); setStatus('Reference removed.'); refresh(); });
  tabs.forEach(tab => tab.addEventListener('click', () => { selectedTab = tab.dataset.tab; tabs.forEach(item => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', item === tab ? 'true' : 'false'); }); render(); }));
  $('generate').addEventListener('click', () => { refresh(); setStatus('Hero prompt updated.'); $('heroOutput').scrollIntoView({behavior:'smooth',block:'nearest'}); });
  $('copyHero').addEventListener('click', async () => { await copy(outputs[selectedTab]); setStatus('Prompt copied.'); });
  $('downloadHero').addEventListener('click', () => { const blob = new Blob([outputs[selectedTab]], {type: selectedTab === 'json' ? 'application/json' : 'text/plain'}); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `femanail-hero-banner-${selectedTab}.${selectedTab === 'json' ? 'json' : 'txt'}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Prompt downloaded.'); });
  $('loadExample').addEventListener('click', () => { const example = {concept:'Personal brand homepage portrait',ratio:'16:9',placement:'Right, leave space on left',framing:'Three-quarter upper-body portrait',background:'Transparent cutout',backgroundCustom:'',outfit:'Chunky knitted crew-neck sweater',outfitColor:'Bright mustard yellow',outfitDetail:'Thick visible knit with playful embroidered crocodile graphic at front center; modest round neckline',hair:'High messy bun with face-framing strands',hairColor:'Natural black with subtle warm brown highlights',accessories:'Small gold hoop earrings, soft glamorous makeup, subtle bindi',hand:'One hand supporting the cheek and jaw; other arm relaxed',posture:'Relaxed seated upper-body pose',gaze:"Looking toward viewer's left",expression:'Warm, cheerful natural smile',lighting:'Soft professional studio light',extra:'Preserve natural skin texture; clean hair, sleeve, and shoulder edges'}; for (const [id,text] of Object.entries(example)) fields[id].value = text; document.querySelector('input[name="tilt"][value="left"]').checked = true; refresh(); setStatus('Reference example loaded. Add a photo to preserve identity.'); });
  $('resetHero').addEventListener('click', () => { for (const field of Object.values(fields)) field.value = ''; fields.ratio.value = '16:9'; fields.placement.value = 'Right, leave space on left'; fields.framing.value = 'Three-quarter upper-body portrait'; fields.background.value = 'Transparent cutout'; fields.gaze.value = 'Looking at camera'; fields.lighting.value = 'Soft professional studio light'; document.querySelector('input[name="tilt"][value="center"]').checked = true; $('removeReference').click(); refresh(); setStatus('Hero brief reset.'); });
  try { const saved = JSON.parse(localStorage.getItem(draftKey) || 'null'); if (saved) { for (const id of ids) if (typeof saved[id] === 'string') fields[id].value = saved[id]; if (['left','center','right'].includes(saved.tilt)) document.querySelector(`input[name="tilt"][value="${saved.tilt}"]`).checked = true; } } catch { /* invalid draft */ }
  refresh();
})();
