
//事件命转换react事件名
export const topLevelEventsToReactNames = new Map();
//事件优先级
const eventPriorities = new Map();

export const registerEventAll = new Set()

export const DiscreteEvent = 1
export const UserBlockingEvent = 2;
export const ContinuousEvent = 3;


type DOMEventName = string
// 离散优先级的事件  500-1000ms
const discreteEventPairsForSimpleEventPlugin:Array<string | DOMEventName> =[
    ('cancel'), 'cancel',
    ('click'), 'click',
    ('close'), 'close',
    ('contextmenu'), 'contextMenu',
    ('copy'), 'copy',
    ('cut'), 'cut',
    ('auxclick'), 'auxClick',
    ('dblclick'), 'doubleClick', // Careful!
    ('dragend'), 'dragEnd',
    ('dragstart'), 'dragStart',
    ('drop'), 'drop',
    ('focusin'), 'focus', // Careful!
    ('focusout'), 'blur', // Careful!
    ('input'), 'input',
    ('invalid'), 'invalid',
    ('keydown'), 'keyDown',
    ('keypress'), 'keyPress',
    ('keyup'), 'keyUp',
    ('mousedown'), 'mouseDown',
    ('mouseup'), 'mouseUp',
    ('paste'), 'paste',
    ('pause'), 'pause',
    ('play'), 'play',
    ('pointercancel'), 'pointerCancel',
    ('pointerdown'), 'pointerDown',
    ('pointerup'), 'pointerUp',
    ('ratechange'), 'rateChange',
    ('reset'), 'reset',
    ('seeked'), 'seeked',
    ('submit'), 'submit',
    ('touchcancel'), 'touchCancel',
    ('touchend'), 'touchEnd',
    ('touchstart'), 'touchStart',
    ('volumechange'), 'volumeChange',
  ];
//用户中断优先级事件 250ms
const userBlockingPairsForSimpleEventPlugin: Array<string | DOMEventName> = [
    ('drag'), 'drag',
    ('dragenter'), 'dragEnter',
    ('dragexit'), 'dragExit',
    ('dragleave'), 'dragLeave',
    ('dragover'), 'dragOver',
    ('mousemove'), 'mouseMove',
    ('mouseout'), 'mouseOut',
    ('mouseover'), 'mouseOver',
    ('pointermove'), 'pointerMove',
    ('pointerout'), 'pointerOut',
    ('pointerover'), 'pointerOver',
    ('scroll'), 'scroll',
    ('toggle'), 'toggle',
    ('touchmove'), 'touchMove',
    ('wheel'), 'wheel',
  ];
//用户连续优先级，同步执行
const continuousPairsForSimpleEventPlugin: Array<string | DOMEventName> = [
    ('abort'), 'abort',
    ('animationEnd'), 'animationEnd',
    ('animationIteration'), 'animationIteration',
    ('animationStart'), 'animationStart',
    ('canplay'), 'canPlay',
    ('canplaythrough'), 'canPlayThrough',
    ('durationchange'), 'durationChange',
    ('emptied'), 'emptied',
    ('encrypted'), 'encrypted',
    ('ended'), 'ended',
    ('error'), 'error',
    ('gotpointercapture'), 'gotPointerCapture',
    ('load'), 'load',
    ('loadeddata'), 'loadedData',
    ('loadedmetadata'), 'loadedMetadata',
    ('loadstart'), 'loadStart',
    ('lostpointercapture'), 'lostPointerCapture',
    ('playing'), 'playing',
    ('progress'), 'progress',
    ('seeking'), 'seeking',
    ('stalled'), 'stalled',
    ('suspend'), 'suspend',
    ('timeupdate'), 'timeUpdate',
    ('transitionEnd'), 'transitionEnd',
    ('waiting'), 'waiting',
  ];

//设置初始化设置优先级
const registerEventsAndSetTheirPriorities = function(eventTypes,priority){
    for (let i = 0; i < eventTypes.length; i += 2) {
        const topEvent = eventTypes[i];
        const event = eventTypes[i + 1];
        const capitalizedEvent = event[0].toUpperCase() + event.slice(1);
        const reactName = 'on' + capitalizedEvent;
        eventPriorities.set(topEvent, priority);
        topLevelEventsToReactNames.set(topEvent, reactName);
        registerEventAll.add(topEvent)
    }
}

//注册事件
export const registerEvents = function(){
    registerEventsAndSetTheirPriorities(discreteEventPairsForSimpleEventPlugin,DiscreteEvent)
    registerEventsAndSetTheirPriorities(userBlockingPairsForSimpleEventPlugin,UserBlockingEvent)
    registerEventsAndSetTheirPriorities(continuousPairsForSimpleEventPlugin,ContinuousEvent)
} 
//获取事件优先级 
export const getEventPriorityForListenerSystem = function(eventName){
    const priority = eventPriorities.get(eventName)
    if(!priority){
        return ContinuousEvent
    }
    return priority
}

