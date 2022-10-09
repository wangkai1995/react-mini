
import { Component } from '../rm-core/classComponent'
import { reactElementType } from '../share/type'
import { Lane,NotLane,LanePriorityType,notLanePriority } from './Lane'
import { UpdateQueue,initializeUpdateQueue } from './update'
import { Task } from './schedulerWithReconciler'
import { isNumber,isString,isFunction } from '../share/tool';

export type FiberModel = 1|2|3|4|7;
export const NoModel = 0b0000;
export const LegacyModel = 0b0001;
export const BlockModel = 0b0010;
export const ConcurrentModel = 0b0100;


export type FiberTag = 1|2|3|4|5|6|7|8|9;
export const HostRoot = 1;
export const ClassComponent = 2;
export const FunctionComponent = 3;
export const HostComponent = 4;
export const HostText = 5;
export const LazyComponent = 6;
export const SuspenseComponent = 7;
export const OffscreenComponent = 8;   //并发模式下使用
export const FragmentComponent = 9;



export type fiberEffect  = number
export const NotEffect = 0b000000000000000000;
export const PlaceEffect = 0b000000000000000001;
export const UpdateEffect = 0b000000000000000010;
export const DeleteEffect = 0b000000000000000100;
export const SnapshotEffect = 0b000000000000001000;
export const HookPassiveEffect = 0b000000000000010000;
export const HookLayoutEffect = 0b000000000000100000;
export const RefEffect = 0b000000000001000000;
export const CallbackEffect = 0b000000000010000000;
export const DidCaptureEffect = 0b000000000100000000;
export const ShouldCaptureEffect = 0b000000001000000000;
export const completeEffect = 0b010000000000000000;
export const incompleteEffect = 0b100000000000000000;
//特殊的 effect,全部副作用effect,主要用来清除和判断
export const HostEffectMask =  0b000000001111111111;


export class Fiber {
    key: string|number = null
    type: string | Function = null;
    tag: FiberTag = null;
    flag:fiberEffect = NotEffect;
    index:number = 0;
    ref: Function|object = null
    mode:FiberModel = null

    pendingProps: any = null;
    memoizedProps: any = null;
    memoizedState: any = null;
    dependencies: any = null;

    updateQueue:UpdateQueue = null
    lane:Lane = null;
    childrenLane:Lane = null;

    stateNode: HTMLElement | Text | Component | FiberRoot | Set<Promise<any>>  = null;
    alternate: Fiber = null;

    firstEffect: Fiber = null;
    lastEffect: Fiber = null;
    nextEffect: Fiber = null;

    children:Fiber = null;
    sibling:Fiber = null;
    return:Fiber|null = null;

    constructor(tag:FiberTag,mode:FiberModel,element?:reactElementType){
        this.tag = tag;
        this.mode = mode;
        if(!element) return;
        this.type = element.type
        this.memoizedProps = element.props
        this.ref = element.ref;
    }
}

export class FiberRoot {
    current: Fiber;
    container: HTMLElement;
    callback:Task = null;
    mode:FiberModel = LegacyModel
    callbackPriority:LanePriorityType = notLanePriority;
    element:reactElementType = null;
    finishedWork:Fiber = null;
    flag:fiberEffect = NotEffect;
    updateQueue:UpdateQueue = null
    //lane相关
    expirationTimes:number[] = [];
    pendingLane:Lane =  NotLane
    expirationLane:Lane = NotLane
    constructor(element:reactElementType,container: HTMLElement,mode:FiberModel) {
        this.container = container
        this.element = element;
        this.mode = mode
    }
}

export const createHostRoot = function(element:reactElementType,container:HTMLElement,mode:FiberModel){
    var currentMode 
    if(mode === ConcurrentModel){
        currentMode = (ConcurrentModel|BlockModel|LegacyModel)
    }else if(mode === BlockModel){
        currentMode = (BlockModel|LegacyModel)
    }else{
        currentMode = LegacyModel
    }
    const hostRootFiber = new Fiber(HostRoot,currentMode);
    const root = new FiberRoot(element,container,currentMode)
    root.current = hostRootFiber
    hostRootFiber.stateNode = root;
    initializeUpdateQueue(hostRootFiber)
    return hostRootFiber
}

export const createWorkProcess = function(fiber:Fiber, pendingProps?: any){
    var workProcess = fiber.alternate
    if(!workProcess){
        workProcess = new Fiber(fiber.tag,fiber.mode);
        //复用剩下的
        workProcess.stateNode = fiber.stateNode
        workProcess.flag = fiber.flag
        workProcess.type = fiber.type
        workProcess.return = fiber.return
        fiber.alternate = workProcess
        workProcess.alternate = fiber
    }else{
        workProcess.flag = NotEffect;
        workProcess.firstEffect = null
        workProcess.lastEffect = null
        workProcess.nextEffect = null
    }
    workProcess.lane = fiber.lane;
    workProcess.childrenLane = fiber.childrenLane;
    workProcess.children = fiber.children
    workProcess.updateQueue = fiber.updateQueue
    workProcess.memoizedState = fiber.memoizedState
    workProcess.memoizedProps = fiber. memoizedProps
    workProcess.index = fiber.index
    workProcess.ref = fiber.ref
    workProcess.dependencies = fiber.dependencies
    workProcess.pendingProps = pendingProps || fiber.pendingProps
    workProcess.sibling = fiber.sibling
    return workProcess;
}

export const createFiberTag = function(element: string|reactElementType ){
    if(typeof element === 'string'){
        return HostText
    }else if(isFunction(element.type) && (element.type as any).isClassComponent){
        return ClassComponent
    }else if(isFunction(element.type) && (element.type as any).isSuspenseComponent){
        return SuspenseComponent
    }else if(isFunction(element.type)){
        return FunctionComponent
    }else if(isString(element.type)){
        return HostComponent
    }
}

export type StackCursor<T> = {current: T};
var index = -1;
const valueStack = []
const fiberStack = []
export const pushStack = function<T>(cursor:StackCursor<T>,value: T, fiber: Fiber){
    index++;
    valueStack[index] = cursor.current;
    fiberStack[index] = fiber
    cursor.current = value;
}
export const popStack = function<T>(cursor: StackCursor<T>, fiber: Fiber){
    if(index<0) return;
    cursor.current = valueStack[index];
    valueStack[index] = null;
    fiberStack[index] = null;
    index--;
}
