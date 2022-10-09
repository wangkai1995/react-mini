import { reactFiberSymbol,reactPropsSymbol } from '../client/ReactDomHostConfig'
import { HostComponent,FiberRoot } from '../../rm-reconciler/Fiber'
import { 
    registerEventAll,topLevelEventsToReactNames,
    DiscreteEvent,UserBlockingEvent,ContinuousEvent,getEventPriorityForListenerSystem 
} from './DomEventPriority'
import { 
    isCapture,batchedEventUpdates,
    dispatchDiscreteEvent,dispatchUserBlockingUpdate,dispatchEvent,
 } from './DomEvent'
import { 
    getEventCharCode,
    SyntheticEvent,
    SyntheticKeyboardEvent,
    SyntheticFocusEvent,
    SyntheticMouseEvent,
    SyntheticDragEvent,
    SyntheticTouchEvent,
    SyntheticAnimationEvent,
    SyntheticTransitionEvent,
    SyntheticUIEvent,
    SyntheticWheelEvent,
    SyntheticClipboardEvent,
    SyntheticPointerEvent,
} from './SyntheticEvent'



const ListenerSet = Symbol('ListenerSet')
const getEventListenerSet = function(target:Element){
    if(target[ListenerSet]){
        return target[ListenerSet]
    }
    target[ListenerSet] = new Set()
    return target[ListenerSet]
}


// 绑定监听事件
const listenToNativeEvent = function(
    domEventName: string,
    isCapturePhaseListener: boolean,
    rootContainerElement: Element,
    targetElement: Element | null,
    eventSystemFlags?: any = 0,
){
    let target = rootContainerElement;
    
    //getEventListenerSet
    const listenerSet = getEventListenerSet(target)
    //getListenerSetKey
    const listenerSetKey = `${domEventName}_${isCapturePhaseListener?'capture':'bubble'}`;
    //resigter
    if (!listenerSet.has(listenerSetKey)) {
        if (isCapturePhaseListener) {
          eventSystemFlags |= isCapture;
        }
        //addTrappedEventListener
        // options 里面的 Passive 和 once的特殊处理先不处理
        let targetContainer = target
        let listener = createEventListenerWrapperWithPriority(
            targetContainer,
            domEventName,
            eventSystemFlags,
        );
        let unsubscribeListener
        if (isCapturePhaseListener) {
            unsubscribeListener = addEventCaptureListener(
                targetContainer,
                domEventName,
                listener,
              );
        }else{
            unsubscribeListener = addEventBubbleListener(
                targetContainer,
                domEventName,
                listener,
            );
        }
        // add set
        listenerSet.add(listenerSetKey);
      }
}
// 创建一个监听
const createEventListenerWrapperWithPriority = function(
    targetContainer:Element,
    domEventName:String,
    eventSystemFlags
){
    const eventPriority = getEventPriorityForListenerSystem(domEventName);
    let listenerWrapper;
    switch (eventPriority) {
      case DiscreteEvent:
        listenerWrapper = dispatchDiscreteEvent;
        break;
      case UserBlockingEvent:
        listenerWrapper = dispatchUserBlockingUpdate;
        break;
      case ContinuousEvent:
      default:
        listenerWrapper = dispatchEvent;
        break;
    }
    return listenerWrapper.bind(
      null,
      domEventName,
      eventSystemFlags,
      targetContainer,
    );
}
// 监听捕获事件
const addEventCaptureListener = function(
    target: EventTarget,
    eventType: string,
    listener: (Event)=>void,
){
    target.addEventListener(eventType, listener, true);
  return listener;
}
// 监听冒泡事件
const addEventBubbleListener = function(
    target: EventTarget,
    eventType: string,
    listener: (Event)=>void,
){
    target.addEventListener(eventType, listener, false);
    return listener;
}
//读取最新的props
const getFiberCurrentPropsFromNode= function(dom){
    return dom[reactPropsSymbol]
}



//执行事件,计算调度队列
function extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer,
) {
    const reactName = topLevelEventsToReactNames.get(domEventName);
    if (reactName === undefined) {
      return;
    }
    let SyntheticEventCtor:any = SyntheticEvent;
    let reactEventType: string = domEventName;
    //根据事件名-生成对应的合成事件
    switch (domEventName) {
        case 'keypress':
          // Firefox creates a keypress event for function keys too. This removes
          // the unwanted keypress events. Enter is however both printable and
          // non-printable. One would expect Tab to be as well (but it isn't).
          if (getEventCharCode(nativeEvent) === 0) {
            return;
          }
        /* falls through */
        case 'keydown':
        case 'keyup':
          SyntheticEventCtor = SyntheticKeyboardEvent;
          break;
        case 'focusin':
          reactEventType = 'focus';
          SyntheticEventCtor = SyntheticFocusEvent;
          break;
        case 'focusout':
          reactEventType = 'blur';
          SyntheticEventCtor = SyntheticFocusEvent;
          break;
        case 'beforeblur':
        case 'afterblur':
          SyntheticEventCtor = SyntheticFocusEvent;
          break;
        case 'click':
          // Firefox creates a click event on right mouse clicks. This removes the
          // unwanted click events.
          if (nativeEvent.button === 2) {
            return;
          }
        /* falls through */
        case 'auxclick':
        case 'dblclick':
        case 'mousedown':
        case 'mousemove':
        case 'mouseup':
        // TODO: Disabled elements should not respond to mouse events
        /* falls through */
        case 'mouseout':
        case 'mouseover':
        case 'contextmenu':
          SyntheticEventCtor = SyntheticMouseEvent;
          break;
        case 'drag':
        case 'dragend':
        case 'dragenter':
        case 'dragexit':
        case 'dragleave':
        case 'dragover':
        case 'dragstart':
        case 'drop':
          SyntheticEventCtor = SyntheticDragEvent;
          break;
        case 'touchcancel':
        case 'touchend':
        case 'touchmove':
        case 'touchstart':
          SyntheticEventCtor = SyntheticTouchEvent;
          break;
        case 'animationEnd':
        case 'animationIteration':
        case 'animationStart':
          SyntheticEventCtor = SyntheticAnimationEvent;
          break;
        case 'transitionEnd':
          SyntheticEventCtor = SyntheticTransitionEvent;
          break;
        case 'scroll':
          SyntheticEventCtor = SyntheticUIEvent;
          break;
        case 'wheel':
          SyntheticEventCtor = SyntheticWheelEvent;
          break;
        case 'copy':
        case 'cut':
        case 'paste':
          SyntheticEventCtor = SyntheticClipboardEvent;
          break;
        case 'gotpointercapture':
        case 'lostpointercapture':
        case 'pointercancel':
        case 'pointerdown':
        case 'pointermove':
        case 'pointerout':
        case 'pointerover':
        case 'pointerup':
          SyntheticEventCtor = SyntheticPointerEvent;
          break;
        default:
          // Unknown event. This is used by createEventHandle.
          break;
    }
    //构建队列
    const inCapturePhase = (eventSystemFlags & isCapture) !== 0;
    const captureName = reactName !== null ? reactName + 'Capture' : null;
    const reactEventName = inCapturePhase ? captureName : reactName;
    //accumulateSinglePhaseListeners 内容简化
    const listeners = [];
    var instance = targetInst
    while (instance) {
        const {stateNode, tag} = instance;
        if (tag === HostComponent && stateNode !== null) {
            //getListener 内容
            const props = getFiberCurrentPropsFromNode(stateNode);  //目前简易处理 从memoizedProps上面读
            // const listener = instance.memoizedProps[reactEventName]  //这里不能这样的简易处理，存在hook缓存的问题
            const listener = props[reactEventName]
            if (listener != null) {
                listeners.push(
                    {
                        instance, 
                        listener, 
                        currentTarget:stateNode
                    }
                );
            }
        }
        instance = instance.return;
    }
    //添加到队列中
    if (listeners.length > 0) {
        const event = new SyntheticEventCtor(
          reactName,
          reactEventType,
          null,
          nativeEvent,
          nativeEventTarget,
        );
        dispatchQueue.push({event, listeners});
    }
}
//执行事件调度队列
function processDispatchQueue(
    dispatchQueue,
    eventSystemFlags,
){
    const inCapturePhase = (eventSystemFlags & isCapture) !== 0;
    for (let i = 0; i < dispatchQueue.length; i++) {
        const {event, listeners} = dispatchQueue[i];
        //processDispatchQueueItemsInOrder 内容
        let previousInstance;
        //如果存在捕获，从数组尾开始捕获
        if (inCapturePhase) {
          for (let i = listeners.length - 1; i >= 0; i--) {
            const {instance, currentTarget, listener} = listeners[i];
            if (instance !== previousInstance && event.isPropagationStopped()) {
              return;
            }
            // executeDispatch(event, listener, currentTarget);
            const type = event.type || 'unknown-event';
            event.currentTarget = currentTarget;
            //invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event);
            listener(event)
            event.currentTarget = null;
            //
            previousInstance = instance;
          }
        } else {
            //不存在捕获，从数组头开始冒泡
          for (let i = 0; i < listeners.length; i++) {
            const {instance, currentTarget, listener} = listeners[i];
            if (instance !== previousInstance && event.isPropagationStopped()) {
              return;
            }
            // executeDispatch(event, listener, currentTarget);
            const type = event.type || 'unknown-event';
            event.currentTarget = currentTarget;
            //invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event);
            listener(event)
            event.currentTarget = null;
            //
            previousInstance = instance;
          }
        }
    }
}




//给容器绑定事件监听
export const listenToAllSupportedEvents = function(rootContainerElement:HTMLElement){
    const flag = '_$React_RegisterEvent'
    if(rootContainerElement[flag]){
        return 
    }
    rootContainerElement[flag] = true;
    registerEventAll.forEach((eventName:string)=> {
        //某些事件不存在捕获，这里暂时没加判断
        //冒泡事件
        listenToNativeEvent(eventName,false,rootContainerElement,null)
        //捕获事件
        listenToNativeEvent(eventName,false,rootContainerElement,null)
    });
}
//触发事件
export const attemptToDispatchEvent = function(
    domEventName,
    eventSystemFlags,
    targetContainer,
    nativeEvent,
){
    const nativeEventTarget = nativeEvent.target;
    let targetInst  = nativeEventTarget[reactFiberSymbol]
    //这里还要检查一下 targetInst是否被挂载，先暂不处理,默认全都被挂载了
    // dispatchEventForPluginEventSystem内容简化
    batchedEventUpdates(()=>{
        //dispatchEventsForPlugins内容简化
        const dispatchQueue = [];
        extractEvents(
            dispatchQueue,
            domEventName,
            targetInst,
            nativeEvent,
            nativeEventTarget,
            eventSystemFlags,
            targetContainer,
        );
        processDispatchQueue(dispatchQueue, eventSystemFlags);
    })
}



