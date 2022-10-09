import { Component } from '../rm-core/classComponent'
import { 
    Fiber,FiberRoot,FiberTag,
    createWorkProcess as createCloneFiber,
    NotEffect,PlaceEffect,UpdateEffect,DeleteEffect,SnapshotEffect,
} from './Fiber'
import { 
    requestUpdateLane
} from './Lane'
import { 
    UpdateState,
    initializeUpdateQueue,processUpdateQueue,cloneUpdateQueue,createUpdateQueue,enqueueUpdate,requestEventTime,
    checkHasForceUpdateAfterProcessing,resetHasForceUpdateBeforeProcessing 
} from './update'
import { scheduleUpdateOnFiber } from './workLoop'
import { shallowEqual } from '../share/tool'



export const classComponentUpdater = {
    enqueueSetState(inst, payload, callback) {
        const fiber = getClassFiber(inst)
        const lane = requestUpdateLane(fiber)
        const eventTime = requestEventTime()
        const update = createUpdateQueue(eventTime,UpdateState,payload,callback)
        enqueueUpdate(fiber,update)
        scheduleUpdateOnFiber(fiber,lane);
    },
    enqueueReplaceState(inst, payload, callback) {
    },
    enqueueForceUpdate(inst, callback) {
    },
}


export const setClassFiber = function(instance:Component,fiber:Fiber){
    instance._reactFiber = fiber
}
export const getClassFiber = function(instance:Component){
    return instance._reactFiber
}


export const constructClassInstance = function(workProcess: Fiber,Component: any,nextProps: any){
    //context相关的内容先不处理,packages/react-reconciler/src/ReactFiberClassComponent.old.js
    const instance = new Component(nextProps);
    const state = (workProcess.memoizedState =
        instance.state !== null && instance.state !== undefined
        ? instance.state
        : null
    );
    //adoptClassInstance
    instance.updater = classComponentUpdater;  //setState实际调用的这个,后续在处理
    setClassFiber(instance,workProcess)
    workProcess.stateNode = instance;
    return instance
}


export const applyDerivedStateFromProps = function(workProcess: Fiber,Component: any,getDerivedStateFromProps:(props: any, state: any) => any,nextProps: any){
    const prevState = workProcess.memoizedState;
    const partialState = getDerivedStateFromProps(nextProps, prevState);
    const memoizedState =
        partialState === null || partialState === undefined
        ? prevState
        : Object.assign({}, prevState, partialState);
    workProcess.memoizedState = memoizedState;
    //lane相关的先不处理,先保持更新队列里面始终是最新的值
    //  if (workProcess.lanes === NoLanes) {
            const updateQueue = nextProps.updateQueue
            updateQueue.baseState = memoizedState;
    //  }
}


export const resumeMountClassInstance = function(workProcess: Fiber,Component: any,nextProps: any){
    const instance = workProcess.stateNode as Component
    const oldProps = workProcess.memoizedProps;
    instance.props = oldProps;
    const getDerivedStateFromProps = Component.getDerivedStateFromProps;
    const hasNewLifecycles =
        typeof getDerivedStateFromProps === 'function' ||
        typeof instance.getSnapshotBeforeUpdate === 'function';
    //重新执行相关生命周期方法
    if (
        !hasNewLifecycles &&
        (typeof instance.UNSAFE_componentWillReceiveProps === 'function' ||
            typeof instance.componentWillReceiveProps === 'function')
        ) {
        if (oldProps !== nextProps /*|| oldContext !== nextContext */) {
            callComponentWillReceiveProps(
                workProcess,
                instance,
                nextProps,
            );
        }
    }
    //恢复强制更新
    resetHasForceUpdateBeforeProcessing();
    //处理更新队列
    const oldState = workProcess.memoizedState;
    let newState = (instance.state = oldState);
    processUpdateQueue(workProcess, nextProps, instance);
    newState = workProcess.memoizedState;
    //如果没有更新
    if (
        oldProps === nextProps &&
        oldState === newState &&
        !checkHasForceUpdateAfterProcessing()
      ) {
        //已经在更新中了，还是要执行相关的生命周期
        if (typeof instance.componentDidMount === 'function') {
            workProcess.flag |= UpdateEffect;
        }
        return false;
    }
    //执行相关的生命周期，更新state
    if (typeof getDerivedStateFromProps === 'function') {
        applyDerivedStateFromProps(
            workProcess,
            Component,
            getDerivedStateFromProps,
            nextProps,
        );
        newState = workProcess.memoizedState;
    }
    //判断是否需要更新
    const shouldUpdate =
        checkHasForceUpdateAfterProcessing() ||
        checkShouldComponentUpdate(
            workProcess,
            Component,
            oldProps,
            nextProps,
            oldState,
            newState,
        );
    //如果需要更新，需要执行相关的生命周期方法
    if (shouldUpdate) {
        if (
            !hasNewLifecycles &&
            (typeof instance.UNSAFE_componentWillMount === 'function' ||
            typeof instance.componentWillMount === 'function')
        ) {
            if (typeof instance.componentWillMount === 'function') {
                instance.componentWillMount();
            }
            if (typeof instance.UNSAFE_componentWillMount === 'function') {
                instance.UNSAFE_componentWillMount();
            }
        }
        if (typeof instance.componentDidMount === 'function') {
            workProcess.flag |= UpdateEffect;
        }
    } else {
        if (typeof instance.componentDidMount === 'function') {
            workProcess.flag |= UpdateEffect;
        }
        workProcess.memoizedProps = nextProps;
        workProcess.memoizedState = newState;
    }
    
    instance.props = nextProps;
    instance.state = newState;

    return shouldUpdate;
}


export const mountClassInstance = function(workProcess: Fiber,Component: any,nextProps: any) {
    const instance = workProcess.stateNode  as Component 
    instance.props = nextProps;
    instance.state = workProcess.memoizedState;
    instance.refs = {};
    initializeUpdateQueue(workProcess);
    //context相关的内容先不处理,packages/react-reconciler/src/ReactFiberClassComponent.old.js
    //开始更新队列
    processUpdateQueue(workProcess, nextProps, instance);
    instance.state = workProcess.memoizedState;
    //处理 getDerivedStateFromProps 静态方法
    const getDerivedStateFromProps = Component.getDerivedStateFromProps;
    if (typeof getDerivedStateFromProps === 'function') {
        applyDerivedStateFromProps(
            workProcess,
            Component,
            getDerivedStateFromProps,
            nextProps,
        );
        instance.state = workProcess.memoizedState;
    }
    //处理ComponentWillMoun生命周期
    if (
        typeof Component.getDerivedStateFromProps !== 'function' &&
        typeof instance.getSnapshotBeforeUpdate !== 'function' &&
        (typeof instance.UNSAFE_componentWillMount === 'function' ||
          typeof instance.componentWillMount === 'function')
    ) {
        callComponentWillMount(workProcess, instance);
        //如果存在调用setState这里立即执行，合并state
        processUpdateQueue(workProcess, nextProps, instance);
        instance.state = workProcess.memoizedState;
    }
    //如果存在componentDidMount声明周期
    if (typeof instance.componentDidMount === 'function') {
        workProcess.flag |= UpdateEffect;
    }
};


export const updateClassInstance  = function(current:Fiber | null,workProcess: Fiber,Component: any,nextProps: any) {
    const instance = workProcess.stateNode as Component 
    cloneUpdateQueue(current, workProcess);
    //处理props
    const unresolvedOldProps = workProcess.memoizedProps;
    const defaultProps = (workProcess.type as any).defaultProp
    const oldProps = Object.assign({},defaultProps,unresolvedOldProps)
    instance.props = oldProps;
    const unresolvedNewProps = workProcess.pendingProps;
    //上下文context先不处理
    const getDerivedStateFromProps = Component.getDerivedStateFromProps;
    const hasNewLifecycles =
        typeof getDerivedStateFromProps === 'function' ||
        typeof instance.getSnapshotBeforeUpdate === 'function';
    //如果有props和context更新需要执行一下相关生命周期方法
    if (
        !hasNewLifecycles &&
        (typeof instance.UNSAFE_componentWillReceiveProps === 'function' ||
            typeof instance.componentWillReceiveProps === 'function')
        ) {
        if (
            unresolvedOldProps !== unresolvedNewProps 
        ) {
            callComponentWillReceiveProps(
                workProcess,
                instance,
                nextProps,
            );
        }
    }
    //恢复强制更新
    resetHasForceUpdateBeforeProcessing();
    //计算新的state
    const oldState = workProcess.memoizedState;
    let newState = (instance.state = oldState);
    processUpdateQueue(workProcess, nextProps, instance);
    newState = workProcess.memoizedState;
    //如果不需要更新,也要执行相关的更新之后的生命周期方法
    if (
        unresolvedOldProps === unresolvedNewProps &&
        oldState === newState &&
        !checkHasForceUpdateAfterProcessing()
    ) {
        if (typeof instance.componentDidUpdate === 'function') {
            if (
                unresolvedOldProps !== current.memoizedProps ||
                oldState !== current.memoizedState
            ) {
                workProcess.flag |= UpdateEffect;
            }
        }
        if (typeof instance.getSnapshotBeforeUpdate === 'function') {
            if (
                unresolvedOldProps !== current.memoizedProps ||
                oldState !== current.memoizedState
            ) {
                workProcess.flag |= UpdateEffect;
            }
        }
        return false;
    }
    //如果存在，执行getDerivedStateFromProps,在计算一下state
    if (typeof getDerivedStateFromProps === 'function') {
        applyDerivedStateFromProps(
            workProcess,
            Component,
            getDerivedStateFromProps,
            nextProps,
        );
        newState = workProcess.memoizedState;
    }
     //判断是否需要更新
    const shouldUpdate =
        checkHasForceUpdateAfterProcessing() ||
        checkShouldComponentUpdate(
            workProcess,
            Component,
            oldProps,
            nextProps,
            oldState,
            newState,
    );
     //如果需要更新，需要执行相关的生命周期方法
    if (shouldUpdate) {
        if (
            !hasNewLifecycles &&
            (typeof instance.UNSAFE_componentWillUpdate === 'function' ||typeof instance.componentWillUpdate === 'function')
        ) {
            if (typeof instance.componentWillUpdate === 'function') {
                instance.componentWillUpdate(nextProps, newState);
            }
            if (typeof instance.UNSAFE_componentWillUpdate === 'function') {
                instance.UNSAFE_componentWillUpdate(nextProps, newState);
            }
        }
        if (typeof instance.componentDidUpdate === 'function') {
            workProcess.flag |= UpdateEffect;
        }
        if (typeof instance.getSnapshotBeforeUpdate === 'function') {
            workProcess.flag |= SnapshotEffect;
        }
      } else {
            if (typeof instance.componentDidUpdate === 'function') {
                if (
                    unresolvedOldProps !== current.memoizedProps ||
                    oldState !== current.memoizedState
                ) {
                    workProcess.flag |= UpdateEffect;
                }
            }
            if (typeof instance.getSnapshotBeforeUpdate === 'function') {
                if (
                    unresolvedOldProps !== current.memoizedProps ||
                    oldState !== current.memoizedState
                ) {
                    workProcess.flag |= SnapshotEffect;
                }
            }
        workProcess.memoizedProps = nextProps;
        workProcess.memoizedState = newState;
      }
      instance.props = nextProps;
      instance.state = newState;
      return shouldUpdate;
};


export function callComponentWillMount(workProcess: Fiber, instance:any) {
    const oldState = instance.state;
    if (typeof instance.componentWillMount === 'function') {
      instance.componentWillMount();
    }
    if (typeof instance.UNSAFE_componentWillMount === 'function') {
      instance.UNSAFE_componentWillMount();
    }
    if (oldState !== instance.state) {
        //如果直接使用的 this.state == xxx 这种直接赋值的情况下
        //需要添加到更新
        classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
    }
}


export function callComponentWillReceiveProps(workProcess: Fiber, instance:any,nextProps: any){
    const oldState = instance.state;
    if (typeof instance.componentWillReceiveProps === 'function') {
      instance.componentWillReceiveProps(nextProps/*nextState context相关的 先不实现*/);
    }
    if (typeof instance.UNSAFE_componentWillReceiveProps === 'function') {
      instance.UNSAFE_componentWillReceiveProps(nextProps/*nextState context相关的 先不实现*/);
    }
    if (oldState !== instance.state) {
        //如果直接使用的 this.state == xxx 这种直接赋值的情况下
        //需要添加到更新
        classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
    }
}


export function checkShouldComponentUpdate(workProcess: Fiber,Component: any,oldProps,nextProps,oldState,newState,):boolean{
    const instance = workProcess.stateNode as Component
    if (typeof instance.shouldComponentUpdate === 'function') {
        const shouldUpdate = instance.shouldComponentUpdate(
            nextProps,
            newState,
        );
        return shouldUpdate;
    }
    if (Component.prototype && Component.prototype.isPureReactComponent) {
        return (
          !shallowEqual(oldProps, nextProps) || !shallowEqual(oldState, newState)
        );
    }
    return true;
}


