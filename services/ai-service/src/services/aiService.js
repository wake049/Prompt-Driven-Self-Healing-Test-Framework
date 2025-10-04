// services/AIService.js
const OpenAI = require('openai');
const config = require('../config/config');

class AIService {
  constructor() {
    this.openai = null;
    this.initializeOpenAI();
  }

  initializeOpenAI() {
    try {
      if (config.openai.apiKey) {
        this.openai = new OpenAI({
          apiKey: config.openai.apiKey,
          timeout: config.openai.timeout,
          maxRetries: config.openai.maxRetries
        });
        console.log('✅ OpenAI client initialized successfully');
      } else {
        console.warn('⚠️ OpenAI API key not found - using heuristic fallback only');
      }
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI client:', error);
    }
  }

  // =========================
  // PUBLIC API
  // =========================
  async generateElementSuggestions(domData, options = {}) {
    const startTime = Date.now();
    try {
      // 0) Validate & normalize up-front
      const validation = this.validateDOMStructure(domData);
      if (!validation.valid) {
        throw new Error(`Invalid DOM data: ${validation.errors.join('; ')}`);
      }
      const elements = (domData.elements || []).map(this.normalizeEl);

      console.log('🎯 Using optimized heuristic analysis for speed...');
      const heuristicResult = this.generateHeuristicSuggestions({ ...domData, elements }, options);
      const processingTime = Date.now() - startTime;
      console.log(`✅ Fast heuristic analysis completed in ${processingTime}ms`);

      return {
        ...heuristicResult,
        method: 'heuristic-optimized',
        model: 'rule-based-fast',
        processingTimeMs: processingTime
      };
    } catch (error) {
      console.error('❌ Fast heuristic suggestion generation failed:', error);
      throw new Error(`Failed to generate element suggestions: ${error.message}`);
    }
  }

  async generateAISuggestions(domData, options = {}) {
    const { maxSuggestions, includeCategories, confidenceThreshold } = options;
    const maxRetries = 2;

    const elements = (domData.elements || []).map(this.normalizeEl);
    const prompt = this.createAnalysisPrompt({ ...domData, elements }, {
      maxSuggestions,
      includeCategories,
      confidenceThreshold
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🤖 AI attempt ${attempt}/${maxRetries}...`);

        const completion = await this.openai.chat.completions.create({
          model: config.openai.model,
          messages: [
            {
              role: "system",
              content: "You are an expert UI automation engineer. Analyze DOM elements and return EXACTLY the requested JSON format. Be fast and precise. Return only valid JSON."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 400,
          temperature: 0,
          response_format: { type: "json_object" },
          timeout: 8000
        });

        const responseText = completion.choices[0].message.content;
        console.log(`📝 AI Response Length: ${responseText?.length || 0} characters`);
        console.log(`📝 AI Response Preview: ${responseText?.substring(0, 200)}...`);

        try {
          if (!responseText || responseText.trim() === '') {
            throw new Error('Empty AI response received');
          }
          if (!responseText.trim().endsWith('}') && !responseText.trim().endsWith(']}')) {
            console.warn('⚠️ AI response appears to be truncated:', responseText.slice(-50));
            throw new Error('AI response appears to be truncated');
          }

          const parsed = JSON.parse(responseText);
          if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
            throw new Error('Invalid AI response format - missing suggestions array');
          }

          const validSuggestions = this.validateAndFilterSuggestions(parsed.suggestions, options);
          console.log(`✅ AI attempt ${attempt} succeeded with ${validSuggestions.length} suggestions`);
          return {
            suggestions: validSuggestions,
            totalTokens: completion.usage?.total_tokens || 0,
            reasoning: parsed.reasoning || 'AI-generated suggestions based on DOM structure'
          };
        } catch (parseError) {
          console.error(`❌ AI attempt ${attempt} parsing failed:`, parseError);
          console.error('Raw AI response:', responseText);
          if (attempt === maxRetries) {
            throw new Error(`AI response parsing failed after ${maxRetries} attempts: ${parseError.message}`);
          }
          console.log(`🔄 Retrying AI call (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (apiError) {
        console.error(`❌ AI attempt ${attempt} API error:`, apiError);
        if (attempt === maxRetries) {
          throw new Error(`OpenAI API failed after ${maxRetries} attempts: ${apiError.message}`);
        }
        console.log(`🔄 Retrying AI call after API error (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // =========================
  // HEURISTICS
  // =========================
  generateHeuristicSuggestions(domData, options = {}) {
    const { maxSuggestions = 50, includeCategories = ['authentication','form','navigation','action','general'] } = options;
    const suggestions = [];

    const elements = domData.elements || [];
    console.log(`⚡ Quality-focused heuristic analysis for ${elements.length} elements`);

    // Pre-filter: high-quality/likely-stable elements (expanded criteria)
    const highQuality = elements.filter(el => {
      const a = el.attributes || {};
      // Use both normalized properties and attributes for compatibility
      const hasGoodId = !!(el.id || a.id) && !this.isDynamicIdentifier(el.id || a.id);
      const hasTestId = !!(el.testid || a['data-testid']);
      const hasGoodName = !!(el.name || a.name) && !this.isDynamicIdentifier(el.name || a.name) && (el.name || a.name).length > 2;
      const hasUniqueRole = !!a.role && ['textbox', 'searchbox', 'combobox', 'button', 'link', 'tab', 'menuitem'].includes(a.role);
      const hasSpecificType = !!a.type && ['email','password','search','tel','url','submit','button','checkbox','radio'].includes(a.type);
      const hasGoodClass = !!(a.class || (el.classes && el.classes.length > 0)) && (
        (a.class && (a.class.includes('btn') || 
        a.class.includes('button') || 
        a.class.includes('submit') || 
        a.class.includes('login') ||
        a.class.includes('search') ||
        a.class.includes('nav') ||
        a.class.includes('menu') ||
        a.class.includes('form'))) ||
        (el.classes && el.classes.some(cls => ['btn', 'button', 'submit', 'login', 'search', 'nav', 'menu', 'form'].includes(cls)))
      );
      const isImportantTag = ['button', 'input', 'select', 'textarea'].includes(el.tag);
      const isVisibleAndInteractive = el.isVisible && el.isInteractive;
      
      // Additional criteria for elements with text or input fields
      const hasUsefulText = !!(el.text || el.innerText) && 
        (el.text || el.innerText).trim().length > 2 && 
        (el.text || el.innerText).trim().length < 100; // Not too long
      const isInputField = el.tag === 'input' || el.tag === 'textarea' || el.tag === 'select';
      const isClickableWithText = (el.tag === 'button' || el.tag === 'a' || a.role === 'button') && hasUsefulText;
      const isFormControl = el.tag === 'form' || a.role === 'form';
      
      // Text verification elements - non-interactive but important for test verification
      const isTextVerificationElement = hasUsefulText && (
        el.tag === 'h1' || el.tag === 'h2' || el.tag === 'h3' || el.tag === 'h4' || el.tag === 'h5' || el.tag === 'h6' || // Headings
        el.tag === 'label' || // Form labels
        el.tag === 'p' || // Paragraphs with meaningful content
        el.tag === 'span' || // Spans with text (often used for messages, status, etc.)
        el.tag === 'div' || // Divs with text content
        a.role === 'alert' || a.role === 'status' || // ARIA alerts/status messages
        (a.class && (a.class.includes('error') || a.class.includes('success') || a.class.includes('warning') || 
                     a.class.includes('message') || a.class.includes('alert') || a.class.includes('notification') ||
                     a.class.includes('title') || a.class.includes('heading') || a.class.includes('label')))
      );
      
      // More inclusive criteria - element qualifies if it has ANY good identifier OR is important/visible OR has useful text/input OR is text verification
      return hasGoodId || hasTestId || hasGoodName || hasUniqueRole || hasSpecificType || hasGoodClass || 
             (isImportantTag && isVisibleAndInteractive) || 
             (isInputField && isVisibleAndInteractive) ||
             (isClickableWithText && isVisibleAndInteractive) ||
             (isFormControl && isVisibleAndInteractive) ||
             (isTextVerificationElement && el.isVisible); // Text elements just need to be visible, not interactive
    });

    console.log(`   🔍 Filtered to ${highQuality.length} high-quality elements with good selectors`);

    if (highQuality.length === 0) {
      console.log('⚠️ No high-quality elements found, returning empty suggestions');
      return {
        suggestions: [],
        reasoning: 'No elements with reliable selectors found on this page'
      };
    }

    // Process
    highQuality.forEach(el => {
      if (this.isProblematicElement(el)) return;

      const locators = this.generateLocators(el, elements);
      const css = locators.css || '';
      if (!css && !locators.xpath) {
        // nothing robust → skip
        return;
      }
      if (css && (css === 'a' || css === 'button' || css === 'div' || css === 'span' || css.includes('hiddenFromScreen'))) {
        // generic → skip
        return;
      }

      // Categorize
      let category = 'general';
      let confidence = 0.6;
      let elementName = 'Interactive Element';
      let description = 'General interactive element';
      const a = el.attributes || {};
      const textContent = (el.text || el.innerText || '').trim();

      // Text verification elements (non-interactive but important for validation)
      if (!el.isInteractive && textContent.length > 2 && textContent.length < 100) {
        if (el.tag === 'h1' || el.tag === 'h2' || el.tag === 'h3') {
          category = 'verification'; confidence = 0.85; elementName = `${el.tag.toUpperCase()} Heading`; description = `Page heading for content verification`;
        } else if (el.tag === 'label') {
          category = 'verification'; confidence = 0.8; elementName = 'Form Label'; description = 'Form field label for verification';
        } else if (a.role === 'alert' || a.role === 'status') {
          category = 'verification'; confidence = 0.9; elementName = 'Status Message'; description = 'Alert or status message for verification';
        } else if (a.class && (a.class.includes('error') || a.class.includes('success') || a.class.includes('warning'))) {
          category = 'verification'; confidence = 0.85; elementName = 'Message'; description = 'Status/error message for verification';
        } else if (el.tag === 'p' || el.tag === 'span' || el.tag === 'div') {
          category = 'verification'; confidence = 0.65; elementName = 'Text Content'; description = 'Text content for verification';
        }
      }
      // Interactive element categorization
      else if ((a.type === 'email' || (el.name && /email|username|login/i.test(el.name))) && el.tag === 'input') {
        category = 'authentication'; confidence = 0.95; elementName = 'Email/Username Input'; description = 'Input field for email/username';
      } else if (a.type === 'password' && el.tag === 'input') {
        category = 'authentication'; confidence = 0.95; elementName = 'Password Input'; description = 'Password input field';
      } else if ((el.tag === 'button' && a.type === 'submit') || (a.role === 'button' && /login|sign\s*in|submit/i.test(el.text || ''))) {
        category = 'authentication'; confidence = 0.85; elementName = 'Submit Button'; description = 'Submit/login button';
      } else if (el.tag === 'input' && a.type && ['text','tel','url','search'].includes(a.type)) {
        category = 'form'; confidence = 0.8; elementName = `${a.type.charAt(0).toUpperCase()+a.type.slice(1)} Input`; description = `Form input (${a.type})`;
      } else if (el.tag === 'select' || el.tag === 'textarea') {
        category = 'form'; confidence = 0.8; elementName = el.tag === 'select' ? 'Dropdown Select' : 'Text Area'; description = `Form ${el.tag}`;
      } else if (el.tag === 'a' && (el.id || el.testid || (el.name && el.name.length > 5) || a.href)) {
        category = 'navigation'; confidence = 0.7; elementName = 'Navigation Link'; description = 'Navigation link/menu item';
      } else if (el.tag === 'button' && (el.id || el.testid || (el.name && el.name.length > 3) || a['aria-label'])) {
        category = 'action'; confidence = 0.75; elementName = 'Action Button'; description = 'Button for user actions';
      }

      if (includeCategories.includes(category)) {
        suggestions.push({
          elementId: `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: elementName,
          description,
          xpath: locators.xpath,
          locator: locators,
          category,
          priority: confidence > 0.9 ? 'high' : confidence > 0.75 ? 'medium' : 'low',
          confidence,
          attributes: {
            tag: el.tag,
            type: a.type,
            isVisible: el.isVisible,
            isInteractive: el.isInteractive
          },
          usageExamples: this.getUsageExamples(category, elementName)
        });
        console.log(`✅ Added ${category} element: ${elementName} with selector: ${locators.css || locators.xpath}`);
      }
    });

    console.log(`⚡ Generated ${suggestions.length} high-quality suggestions`);
    
    // Deduplicate suggestions by more specific criteria
    const deduplicatedSuggestions = [];
    const seenElements = new Set();
    
    suggestions.forEach(suggestion => {
      // Create a more specific deduplication key
      const selector = suggestion.locator?.css || suggestion.xpath || '';
      const buttonText = selector.includes('contains(') ? 
        selector.match(/contains\([^,]+,\s*['"]([^'"]+)['"]/)?.[1] || '' : '';
      const elementType = suggestion.attributes?.tag || '';
      const elementClass = suggestion.locator?.css?.includes('.') ? 
        suggestion.locator.css.split('.')[1]?.split(/[\s\[\]:]/)[0] || '' : '';
      
      // More specific deduplication - only consider true duplicates
      const dedupKey = buttonText ? 
        `${elementType}:text:${buttonText}` : // Use text for buttons with text
        `${elementType}:selector:${selector.substring(0, 50)}`; // Use partial selector for others
      
      if (!seenElements.has(dedupKey)) {
        seenElements.add(dedupKey);
        deduplicatedSuggestions.push(suggestion);
      } else {
        console.log(`🔄 Skipped duplicate: ${suggestion.name} (${dedupKey})`);
      }
    });
    
    console.log(`🧹 Deduplicated from ${suggestions.length} to ${deduplicatedSuggestions.length} suggestions`);
    
    const sortedSuggestions = deduplicatedSuggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);

    return {
      suggestions: sortedSuggestions,
      reasoning: 'High-quality element detection focusing on elements with reliable, stable selectors'
    };
  }

  // =========================
  // SELECTOR SYNTHESIS
  // =========================

  // Normalize raw element into a consistent shape
  normalizeEl = (raw) => {
    const attributes = raw.attributes || raw.attrs || {};
    const cls = (attributes.class || raw.class || '').toString();
    const testid = raw.testid || attributes['data-testid'] || attributes['data-test'] || undefined;
    const id = raw.id || attributes.id || undefined;
    const name = raw.name || attributes.name || undefined;
    const text = (raw.text || raw.innerText || '').toString().replace(/\s+/g,' ').trim();

    return {
      tag: (raw.tag || '').toLowerCase(),
      id,
      testid,
      name,
      classes: Array.isArray(raw.classes) ? raw.classes : (cls ? cls.split(/\s+/).filter(Boolean) : []),
      attributes: {
        role: attributes.role,
        type: attributes.type,
        href: attributes.href,
        value: attributes.value,
        title: attributes.title,
        placeholder: attributes.placeholder,
        'aria-label': attributes['aria-label']
      },
      text,
      xpath: raw.xpath,
      isVisible: !!raw.isVisible,
      isInteractive: !!raw.isInteractive
    };
  };

  // Count occurrences of a property value among all elements
  countValue(all, propPath, value, tagFilter) {
    if (!value) return 0;
    const get = (el) => {
      const a = el.attributes || {};
      switch (propPath) {
        case 'id': return el.id;
        case 'testid': return el.testid;
        case 'name': return el.name;
        case 'attributes.role': return a.role;
        case 'attributes.type': return a.type;
        case 'attributes.href': return a.href;
        case 'attributes.title': return a.title;
        case 'attributes.placeholder': return a.placeholder;
        case 'attributes.aria': return a['aria-label'];
        case 'classToken': return (el.classes || []).includes(value) ? value : null;
        case 'text': return el.text;
        default: return undefined;
      }
    };
    let count = 0;
    for (const el of all) {
      if (tagFilter && el.tag !== tagFilter) continue;
      const v = get(el);
      if (v === value) count++;
      if (propPath === 'classToken' && v === value) count++; // already incremented
    }
    return count;
  }

  // choose a stable class token (non-hashy) that is rare in the page
  pickStableClassToken(all, el) {
    const tokens = (el.classes || []).filter(c => !this.isDynamicIdentifier(c) && !/--/.test(c) && !/^[a-z]+_[a-zA-Z0-9_]+$/.test(c) && c.length > 2 && c.length < 30);
    if (!tokens.length) return undefined;
    const scored = tokens.map(t => ({ t, n: this.countValue(all, 'classToken', t, el.tag) }));
    scored.sort((a,b) => a.n - b.n);
    return scored[0]?.t;
  }

  // Extract id from an XPath like //*[@id="..."]  (for context anchoring)
  extractIdFromXPath(xp) {
    if (!xp) return null;
    const m = xp.match(/@id=['"]([^'"]+)['"]/);
    return m ? m[1] : null;
  }

  // Generate robust CSS/XPath for an element using only domData (no document)
  generateLocators(el, all) {
    const locators = {};
    const a = el.attributes || {};
    const tag = el.tag || '*';

    console.log('🔍 Generating locators for element:', {
      tag: el.tag, id: el.id, testid: el.testid, name: el.name,
      attrs: a, hasClasses: !!(el.classes && el.classes.length), hasXpath: !!el.xpath
    });

    // Priority 1: Unique ID
    if (el.id && !this.isDynamicIdentifier(el.id) && this.countValue(all, 'id', el.id) === 1) {
      locators.id = el.id;
      locators.css = `[id="${el.id}"]`;
      locators.xpath = `//*[@id='${el.id}']`;
      console.log(`✅ Using ID selector: ${locators.css}`);
      return locators;
    }

    // Priority 2: Unique data-testid
    if (el.testid && this.countValue(all, 'testid', el.testid) === 1) {
      locators.css = `[data-testid="${el.testid}"],[data-test="${el.testid}"]`;
      locators.xpath = `//*[@data-testid='${el.testid}' or @data-test='${el.testid}']`;
      console.log(`✅ Using testid selector: ${locators.css}`);
      return locators;
    }

    // Priority 3: Unique name (mostly inputs)
    if (el.name && !this.isDynamicIdentifier(el.name) && this.countValue(all, 'name', el.name, tag) === 1) {
      locators.css = `${tag}[name="${el.name}"]`;
      locators.xpath = `//${tag}[@name='${el.name}']`;
      console.log(`✅ Using name selector: ${locators.css}`);
      return locators;
    }

    // Priority 4: aria-label / placeholder / title (unique within tag)
    const aria = a['aria-label'];
    if (aria && this.countValue(all, 'attributes.aria', aria, tag) === 1) {
      locators.css = `${tag}[aria-label="${aria}"]`;
      locators.xpath = `//${tag}[@aria-label='${aria}']`;
      console.log(`✅ Using aria-label selector: ${locators.css}`);
      return locators;
    }
    if (a.placeholder && this.countValue(all, 'attributes.placeholder', a.placeholder, tag) === 1) {
      locators.css = `${tag}[placeholder="${a.placeholder}"]`;
      locators.xpath = `//${tag}[@placeholder='${a.placeholder}']`;
      console.log(`✅ Using placeholder selector: ${locators.css}`);
      return locators;
    }
    if (a.title && this.countValue(all, 'attributes.title', a.title, tag) === 1) {
      locators.css = `${tag}[title="${a.title}"]`;
      locators.xpath = `//${tag}[@title='${a.title}']`;
      console.log(`✅ Using title selector: ${locators.css}`);
      return locators;
    }

    // Priority 5: Href tail for links
    if (tag === 'a' && a.href) {
      const token = a.href.split('?')[0].split('#')[0];
      const tail = token.slice(-40);
      // Check if href tail is rare within <a>
      const approxCount = all.filter(x => x.tag === 'a' && (x.attributes?.href || '').endsWith(tail)).length;
      if (approxCount === 1) {
        locators.css = `a[href$="${tail}"]`;
        locators.xpath = `//a[substring(@href, string-length(@href)-${tail.length - 1})='${tail}']`;
        console.log(`✅ Using href-tail selector: ${locators.css}`);
        return locators;
      }
    }

    // Priority 6: Stable class token (rare within tag)
    const stable = this.pickStableClassToken(all, el);
    if (stable) {
      const count = this.countValue(all, 'classToken', stable, tag);
      locators.css = `${tag}.${stable}`;
      locators.xpath = `//${tag}[contains(@class,'${stable}')]`;
      console.log(`✅ Using class-based selector: ${locators.css} (count in tag = ${count})`);
      // keep going if count > 1; otherwise return
      if (count === 1) return locators;
    }

    // Priority 7: Anchor via XPath id segment (if available)
    const idFromXp = this.extractIdFromXPath(el.xpath);
    if (idFromXp && !this.isDynamicIdentifier(idFromXp)) {
      locators.css = `#${idFromXp} ${tag}`;
      locators.xpath = `//*[@id='${idFromXp}']//${tag}`;
      console.log(`✅ Using xpath-anchored selector: ${locators.css}`);
      return locators;
    }

    // Priority 8: Short text fallback (only if given in payload)
    if (el.text && el.text.length <= 80 && !this.isGenericText(el.text)) {
      const t = el.text.replace(/"/g, '\\"');
      locators.xpath = `//${tag}[contains(normalize-space(.),"${t}")]`;
      console.log(`✅ Using text-based XPath: ${locators.xpath}`);
      return locators;
    }

    // Final fallback: tag + best available attribute (but avoid pure tag)
    if (stable) {
      locators.css = `${tag}.${stable}`;
      locators.xpath = `//${tag}[contains(@class,'${stable}')]`;
      console.log(`⚠️ Using class fallback: ${locators.css}`);
    } else if (aria) {
      locators.css = `${tag}[aria-label="${aria}"]`;
      locators.xpath = `//${tag}[@aria-label='${aria}']`;
      console.log(`⚠️ Using aria-label fallback: ${locators.css}`);
    } else if (a.type && tag === 'input') {
      locators.css = `input[type="${a.type}"]`;
      locators.xpath = `//input[@type='${a.type}']`;
      console.log(`⚠️ Using input-type fallback: ${locators.css}`);
    } else {
      // leave empty rather than returning generic 'a'/'button'
      console.log(`❌ No robust selector found; avoiding generic "${tag}"`);
    }

    return locators;
  }

  // =========================
  // HELPERS
  // =========================

  getUsageExamples(category, elementName) {
    const examples = {
      authentication: {
        'Email/Username Input': ['Enter email address', 'Type username'],
        'Password Input': ['Enter password', 'Type secure password'],
        'Submit Button': ['Click to login', 'Submit credentials']
      },
      form: {
        'Text Input': ['Enter text', 'Fill field'],
        'Search Input': ['Enter search query', 'Type search term'],
        'Tel Input': ['Enter phone number', 'Type telephone'],
        'Url Input': ['Enter website URL', 'Type web address'],
        'Dropdown Select': ['Select option', 'Choose from dropdown'],
        'Text Area': ['Enter long text', 'Type message']
      },
      navigation: {
        'Navigation Link': ['Click to navigate', 'Access page section']
      },
      action: {
        'Action Button': ['Click to perform action', 'Execute command'],
        'Submit Button': ['Submit form', 'Complete action']
      }
    };
    return examples[category]?.[elementName] || ['Interact with element', 'Use element'];
  }

  createAnalysisPrompt(domData, options) {
    const structureJson = JSON.stringify({
      pageInfo: {
        title: domData.title,
        url: domData.url,
        elementCount: (domData.elements || []).length
      },
      elements: (domData.elements || []).map(el => ({
        tag: el.tag,
        id: el.id,
        testid: el.testid,
        classes: el.classes,
        attributes: el.attributes,
        text: el.text,
        xpath: el.xpath,
        isVisible: el.isVisible,
        isInteractive: el.isInteractive
      }))
    }, null, 2);

    return `Analyze this MCP-compliant DOM structure and suggest ${options.maxSuggestions} useful elements for automation testing.

Categories to include: ${options.includeCategories.join(', ')}
Minimum confidence threshold: ${options.confidenceThreshold}

DOM Structure (structural metadata only, no private content):
${structureJson}

Return a JSON response with this exact structure:
{
  "suggestions": [
    {
      "elementId": "unique_identifier",
      "name": "descriptive_name",
      "description": "purpose_and_usage",
      "xpath": "element_xpath",
      "locator": {
        "id": "id_if_available",
        "css": "css_selector",
        "xpath": "xpath_selector"
      },
      "category": "authentication|form|navigation|action|general",
      "priority": "high|medium|low",
      "confidence": 0.95,
      "attributes": {
        "tag": "element_tag",
        "isVisible": true,
        "isInteractive": true
      },
      "usageExamples": ["Click to submit", "Enter username"]
    }
  ],
  "reasoning": "brief_explanation_of_suggestions"
}

Focus on elements most likely useful in automation. Prioritize interactive elements with stable, unique identifiers. Avoid generic selectors like "a" or "button".`;
  }

  isProblematicElement(el) {
    if (!el) return true;
    const problematicClasses = [
      'hiddenFromScreen', 'screenReader', 'sr-only', 'visually-hidden',
      'skip-link', 'skip-content', 'accessibility'
    ];
    const cls = (el.classes || []).join(' ').toLowerCase();
    if (problematicClasses.some(s => cls.includes(s.toLowerCase()))) return true;

    const href = el.attributes?.href;
    if (href && (href === '#content' || href === '#main' || href.startsWith('#skip'))) return true;

    if (el.id && this.isDynamicIdentifier(el.id) && !el.text && !el.attributes?.name && !el.testid) return true;

    return false;
  }

  isDynamicIdentifier(id) {
    if (!id) return false;
    const patterns = [
      /\d{10,}/,                 // long numbers
      /[a-f0-9]{8,}/i,           // long hex
      /__[A-Z][a-zA-Z0-9_]+__/,  // CSS modules
      /^[a-z]+\d+$/,             // word+digits
      /react-/i,
      /mui-/i,
      /\b[A-Za-z]+__\w{4,}\b/,   // BEM-ish/hashy
    ];
    return patterns.some(rx => rx.test(id));
  }

  isGenericText(text) {
    if (!text) return true;
    const generic = ['click','button','link','menu','nav','header','footer','content','main','section','div','span','item'];
    return generic.some(g => text.toLowerCase().includes(g) && text.length < 10);
  }

  getStableClasses(classes) {
    if (!classes || !Array.isArray(classes)) return [];
    return classes.filter(cls =>
      !this.isDynamicIdentifier(cls) &&
      !cls.includes('--') &&
      !/^[a-z]+_[a-zA-Z0-9_]+$/.test(cls) &&
      cls.length > 2 && cls.length < 30
    ).slice(0, 2);
  }

  validateAndFilterSuggestions(suggestions, options = {}) {
    const { confidenceThreshold = 0.6, maxSuggestions = 50 } = options;
    return suggestions
      .filter(s => s && s.elementId && s.name && (s.locator?.css || s.locator?.xpath) && s.category && s.confidence >= confidenceThreshold)
      .slice(0, maxSuggestions);
  }

  validateDOMStructure(domData) {
    const errors = [];
    const warnings = [];

    if (!domData) {
      errors.push('DOM data is required');
      return { valid: false, errors, warnings };
    }
    if (!domData.elements || !Array.isArray(domData.elements)) {
      errors.push('Elements array is required');
      return { valid: false, errors, warnings };
    }
    (domData.elements || []).forEach((el, i) => {
      if (!el.tag) errors.push(`Element ${i}: tag is required`);
      if (!el.xpath) warnings.push(`Element ${i}: xpath is missing (not fatal)`);
    });
    return { valid: errors.length === 0, errors, warnings, elementCount: (domData.elements || []).length };
  }
}

module.exports = new AIService();
