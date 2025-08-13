/*
 * Minimal React-like library
 *
 * This file implements a very small subset of React's API sufficient
 * for the purposes of this exercise. The implementation supports
 * functional components, a basic `useState` hook, and a `render`
 * function that mounts a virtual DOM tree into a real DOM container.
 * Every state update triggers a full re-render of the root
 * component. Because the tree is re-rendered from scratch on each
 * update, the implementation does not attempt to perform
 * reconciliation or diffing. This trade‑off keeps the code simple
 * while still enabling stateful interactive applications.
 */

(() => {
  // Array used to store state values for hooks. Each time a
  // component renders, the hookIndex is reset to zero and hooks
  // consume indices in this array in the order they are called.
  let hookStates = [];
  let hookIndex = 0;
  // References to the current root element and container so that
  // state updates can trigger a full re-render.
  let currentRootElement = null;
  let currentContainer = null;

  /**
   * useState provides a way to persist stateful values across
   * re-renders. When called, it returns the current state value and
   * a setter function that updates the state and schedules a new
   * render. If the state at the current index has never been
   * initialized, the initialValue passed by the caller is used.
   *
   * @param {*} initialValue The initial state value.
   * @returns {[any, Function]} A tuple with the current state and a
   *   function to update it.
   */
  function useState(initialValue) {
    const stateIndex = hookIndex;
    // Initialize state if necessary
    if (hookStates[stateIndex] === undefined) {
      hookStates[stateIndex] = initialValue;
    }
    const setState = (newValue) => {
      // Allow newValue to be a function of previous state
      if (typeof newValue === 'function') {
        hookStates[stateIndex] = newValue(hookStates[stateIndex]);
      } else {
        hookStates[stateIndex] = newValue;
      }
      // After updating state we reset the hook index and re-render
      hookIndex = 0;
      render(currentRootElement, currentContainer);
    };
    const value = hookStates[stateIndex];
    hookIndex++;
    return [value, setState];
  }

  /**
   * createElement constructs a virtual DOM element. This function
   * accepts a type (string for native elements or function for
   * components), an optional props object, and an arbitrary number
   * of children. Children can be elements, strings, numbers, arrays
   * or null/undefined values. Nested arrays are flattened so that
   * consumers can map over data structures without worrying about
   * grouping.
   *
   * @param {string|Function} type Tag name or component function
   * @param {object|null} props Element attributes and event handlers
   * @param {...any} children The element's children
   */
  function createElement(type, props, ...children) {
    // Flatten nested children arrays and remove null/false/undefined
    const flatChildren = [];
    const addChild = (child) => {
      if (Array.isArray(child)) {
        child.forEach(addChild);
      } else if (child === null || child === false || child === undefined) {
        return;
      } else {
        flatChildren.push(child);
      }
    };
    children.forEach(addChild);
    return { type, props: props || {}, children: flatChildren };
  }

  /**
   * appendElement converts a virtual element tree into real DOM nodes
   * and appends them to the provided container. It recursively
   * processes functional components, native element types, strings,
   * numbers and arrays. Event handlers passed as props starting with
   * 'on' (e.g. onClick) are converted into DOM event listeners. A
   * 'className' prop is mapped to the 'class' attribute, and the
   * 'style' prop accepts an object of CSS properties.
   *
   * @param {*} node Virtual element or primitive value
   * @param {HTMLElement} container DOM node to append into
   */
  function appendElement(node, container) {
    // Strings and numbers become text nodes
    if (typeof node === 'string' || typeof node === 'number') {
      const textNode = document.createTextNode(String(node));
      container.appendChild(textNode);
      return;
    }
    // Arrays are flattened automatically by createElement but we
    // handle them defensively here in case external consumers pass
    // arrays directly into appendElement.
    if (Array.isArray(node)) {
      node.forEach((child) => appendElement(child, container));
      return;
    }
    // Functional components are invoked with props and children
    if (typeof node.type === 'function') {
      const component = node.type;
      // Spread props and children so they can be accessed in the
      // component as separate properties. This mirrors React's
      // behaviour where props.children contains the array of
      // children.
      const rendered = component(Object.assign({}, node.props, { children: node.children }));
      appendElement(rendered, container);
      return;
    }
    // Create a DOM element for native HTML tags
    const dom = document.createElement(node.type);
    // Apply attributes and event listeners
    Object.entries(node.props).forEach(([name, value]) => {
      if (name.startsWith('on') && typeof value === 'function') {
        // Convert e.g. onClick -> click
        const eventType = name.slice(2).toLowerCase();
        dom.addEventListener(eventType, value);
      } else if (name === 'className') {
        dom.setAttribute('class', value);
      } else if (name === 'style' && typeof value === 'object') {
        Object.entries(value).forEach(([propName, propValue]) => {
          dom.style[propName] = propValue;
        });
      } else if (name !== 'children') {
        // For standard DOM properties such as value, checked, etc., set
        // the property directly. Fallback to setAttribute for unknown
        // attributes. Avoid setting null/undefined values.
        if (value !== null && value !== undefined) {
          if (name in dom) {
            dom[name] = value;
          } else {
            dom.setAttribute(name, value);
          }
        }
      }
    });
    // Recursively append children
    node.children.forEach((child) => appendElement(child, dom));
    container.appendChild(dom);
  }

  /**
   * render mounts a virtual element tree into a DOM container. It
   * resets the hook index to zero on each call so that hooks reuse
   * their positions across renders. Re-rendering the root element
   * after a state update works because currentRootElement and
   * currentContainer maintain references to the last rendered
   * component tree and container.
   *
   * @param {*} element Virtual element tree
   * @param {HTMLElement} container DOM container to mount into
   */
  function render(element, container) {
    hookIndex = 0;
    currentRootElement = element;
    currentContainer = container;
    // Clear existing DOM nodes
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    appendElement(element, container);
  }

  // Expose the API globally as React so that application code can
  // reference it in the familiar way. Only the methods used by
  // app.js are exported.
  window.React = {
    createElement,
    render,
    useState,
  };
})();