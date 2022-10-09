/**
 * 检查script基本数据类型
 * @param mixed value
 * @return boolean
 */
export function isNumber(value) {
  return Object.prototype.toString.call(value) == "[object Number]";
}
export function isString(value) {
  return Object.prototype.toString.call(value) == "[object String]";
}
export function isArray(value) {
  return Object.prototype.toString.call(value) == "[object Array]";
}
export function isBoolean(value) {
  return Object.prototype.toString.call(value) == "[object Boolean]";
}
export function isRegExp(value) {
  return Object.prototype.toString.call(value) == "[object RegExp]";
}
export function isDateObject(value) {
  return Object.prototype.toString.call(value) == "[object Date]";
}
export function isUndefined(value) {
  return value === undefined;
}
export function isNull(value) {
  return value === null;
}
export function isExist(value) {
  return !isUndefined(value) && !isNull(value);
}
export function isSymbol(value) {
  return Object.prototype.toString.call(value) == "[object Symbol]";
}
export function isSVGElement(value) {
  return (
    isElement(value) && (value instanceof SVGElement || value.ownerSVGElement)
  );
}
export function isObject(value) {
  return (
    Object.prototype.toString.call(value) == "[object Object]" ||
    // if it isn't a primitive value, then it is a common object
    (!isNumber(value) &&
      !isString(value) &&
      !isBoolean(value) &&
      !isDateObject(value) &&
      !isRegExp(value) &&
      !isArray(value) &&
      !isNull(value) &&
      !isFunction(value) &&
      !isUndefined(value) &&
      !isSymbol(value))
  );
}
export function isEmptyObject(obj) {
  if (!isObject(obj)) {
    return true;
  }
  for (var key in obj) {
    return false;
  }
  return true;
}
export function isEmptyArray(array) {
  if (!isArray(array)) {
    return true;
  }
  return array.length > 0 ? false : true;
}
export function isFunction(value) {
  return Object.prototype.toString.call(value) == "[object Function]";
}
export function isElement(value) {
  return typeof HTMLElement === "object"
    ? value instanceof HTMLElement //DOM2
    : value &&
        typeof value === "object" &&
        value !== null &&
        value.nodeType === 1 &&
        typeof value.nodeName === "string";
}
export function isWindow(value) {
  var toString = Object.prototype.toString.call(value);
  return (
    toString == "[object global]" ||
    toString == "[object Window]" ||
    toString == "[object DOMWindow]"
  );
}
/**
 * 检查是否是普通空对象
 * @param object obj
 * @return boolean
 */
export function isPlainObject(obj) {
  var hasOwn = Object.prototype.hasOwnProperty;
  // Must be an Object.
  if (!obj || typeof obj !== "object" || obj.nodeType || isWindow(obj)) {
    return false;
  }
  try {
    if (
      obj.constructor &&
      !hasOwn.call(obj, "constructor") &&
      !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")
    ) {
      return false;
    }
  } catch (e) {
    return false;
  }
  var key;
  for (key in obj) {
  }
  return key === undefined || hasOwn.call(obj, key);
}
/*
        转换工具
    */
export function toArray(array) {
  return Array.prototype.slice.call(array);
}
export function toString(content) {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  return content.toString();
}

/*
  生产唯一ID
*/
export function getUniqueID() {
  var id = "xxxxxxxx-xxx-t".replace(/[xyt]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      t = new Date().getTime().toString(),
      v = c == "x" ? r : c == "t" ? t : (r & 0x3) | 0x8;
    return c == "t" ? t : v.toString();
  });
  return id;
}

export function shallowEqual(objA, objB): boolean {
    function is(x: any, y: any) {
        return (
          (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y) // eslint-disable-line no-self-compare
        );
    }
    if (is(objA, objB)) {
      return true;
    }
  
    if (
      typeof objA !== 'object' ||
      objA === null ||
      typeof objB !== 'object' ||
      objB === null
    ) {
      return false;
    }
  
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
  
    if (keysA.length !== keysB.length) {
      return false;
    }
  
    // Test for A's keys different from B.
    for (let i = 0; i < keysA.length; i++) {
      if (
        !Object.hasOwnProperty.call(objB, keysA[i]) ||
        !is(objA[keysA[i]], objB[keysA[i]])
      ) {
        return false;
      }
    }
  
    return true;
  }