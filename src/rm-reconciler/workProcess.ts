import { Component } from '../rm-core/classComponent'
import { 
    Fiber,FiberRoot,FiberTag,
    createWorkProcess as createCloneFiber,
    NotEffect,PlaceEffect,incompleteEffect,DidCaptureEffect,HostEffectMask,
    HostRoot,ClassComponent,FunctionComponent,HostComponent,HostText,LazyComponent,SuspenseComponent,OffscreenComponent,FragmentComponent,
} from './Fiber'
import { NotLane,Lane,OffscreenLane,resetChildLanes } from './Lane'
import { processUpdateQueue,cloneUpdateQueue } from './update'
import { mountChildrenFiber,reconcileChildrenFiber } from './FiberChild'
import { shouldSetTextContent,updateRef } from './platform/index'
import { renderWithHooks } from './hook'
import { completeWork,unwindWork } from './workComplete'
import { 
    pushRenderLanes,getSubtreeRenderLanes,
    getWorkInProgressRootExitStatus,setWorkInProgressRootExitStatus,RootIncomplete,RootCompleted
} from './workLoop'
import { constructClassInstance,mountClassInstance,updateClassInstance,resumeMountClassInstance } from './classComponent'
import { 
    shouldRemainOnFallback,getRemainingWorkInPrimaryTree,
    mountSuspenseFallbackChildren,mountSuspensePrimaryChildren,mountSuspenseOffscreenState,
    updateSuspenseOffscreenState,updateSuspensePrimaryChildren,updateSuspenseFallbackChildren,
} from './suspenseComponent'


var workProcessRoot = null;
var workProcess = null;
export const getWorkProcessRoot = function(){return workProcessRoot}
export const setWorkProcessRoot = function(newWorkProcessRoot){
    workProcessRoot = newWorkProcessRoot
    return workProcessRoot
}
export const getWorkProcess = function(){return workProcess}
export const setWorkProcess = function(newWorkProcess){
    workProcess = newWorkProcess;
    return workProcess
}
//创建工作节点
export const createWorkProcess = (...parames)=>createCloneFiber.apply(null,parames);



var didReceiveUpdate = false;  //是否接收更新
//开始节点计算
//beginWork  里面进入堆栈，还没处理context上下文，先不处理这个
export const beginWork = function(current:Fiber|null,workProcess:Fiber,lane:Lane):Fiber|null{
    //需要判断是否跳过更新
    if(current){
        const oldProps = current.memoizedProps;
        const newProps = workProcess.pendingProps;
        //存在更新
        if(oldProps !== newProps){
            didReceiveUpdate = true
        }else if(!((workProcess.lane & lane) !== NotLane)){
            //这里简化了,lane相关的内容 !(workProcess.lane & subtreeRenderLanes) !== NotLane
            //简化了推入堆栈，更新上下文,暂无实现
            return bailoutOnAlreadyFinishedWork(workProcess,lane);
        }else{
            didReceiveUpdate = false;
        }
    }
    //即将开始更新就清理当前的lane标记
    workProcess.lane = NotLane;
    // mount & update;
    switch(workProcess.tag){
        case HostRoot:
            return updateHostRoot(current,workProcess,lane)
        case LazyComponent://懒加载组件,暂不处理
            return null;
        case ClassComponent://类组件
            const classComponent = workProcess.type as (props?: any) => any
            const defaultProps = (workProcess.type as any).defaultProp
            const classResolvedProps = Object.assign({},defaultProps,workProcess.pendingProps)
            return updateClassComponent(
                current,
                workProcess,
                classComponent,
                classResolvedProps,
                lane
            )
        case FunctionComponent://函数组件
            const functionComponent = workProcess.type as (props?: any) => any
            const functionResolvedProps = workProcess.pendingProps;
            return updateFunctionComponent(
                current,
                workProcess,
                functionComponent,
                functionResolvedProps
            )
        case SuspenseComponent: //悬挂组件
            return updateSuspenseComponent(
                current,
                workProcess,
                lane
            )
        case OffscreenComponent: //keep-alive组件
            return updateOffscreenComponent( current,workProcess,lane)
        case FragmentComponent:  //组件集合
            return updateFragmentComponent(current,workProcess,lane)
        case HostComponent://原生dom
            return updateHostComponent(
                current,
                workProcess
            )
        case HostText://原生文本
            return updateTextComponent(
                current,
                workProcess
            )
    }
}
//计算末尾节点
export const completeUnitOfWork = function(unitOfWork:Fiber){
    let completedWork:any = unitOfWork;
    do{
        const current = completedWork.alternate;
        const returnFiber = completedWork.return;
        //这里需要判断之前是否处理完整
        if((completedWork.flag & incompleteEffect) === NotEffect ){
            let next = completeWork(current, completedWork,getSubtreeRenderLanes());
            //如果不为空,说明出现了新的节点任务
            if (next) {
                setWorkProcess(next);
                return;
            }
            //恢复子节点childlane
            resetChildLanes(completedWork)
            //向上传递副作用
            if(returnFiber && (returnFiber.flag & incompleteEffect) === NotEffect ){
                //当前节点的children effect传递
                if (!returnFiber.firstEffect) {
                    returnFiber.firstEffect = completedWork.firstEffect;
                }
                if (completedWork.lastEffect) {
                    if (returnFiber.lastEffect) {
                        returnFiber.lastEffect.nextEffect = completedWork.firstEffect;
                    }
                    returnFiber.lastEffect = completedWork.lastEffect;
                }
                //检查自己是否有副作用,如果有则挂载到副作用链上
                if(completedWork.flag > NotEffect){
                    if (returnFiber.lastEffect) {
                        returnFiber.lastEffect.nextEffect = completedWork;
                    } else {
                        returnFiber.firstEffect = completedWork;
                    }
                    returnFiber.lastEffect = completedWork;
                }
            }
        }else{
            const next = unwindWork(completedWork)
            if(next) {
                //清理掉当前节点的全部副作用标记
                next.flag &= HostEffectMask
                setWorkProcess(next);
                return;
            }
            if (returnFiber !== null) {
                //父节点也添加未完成标签,向上回溯,直到遇到classComponent或者到达root节点
                returnFiber.firstEffect = returnFiber.lastEffect = null;
                returnFiber.flag |= incompleteEffect;
            }
        }
        //如果存在兄弟节点,那么开始另外的performUnitOfWork
        const siblingFiber = completedWork.sibling;
        if (siblingFiber) {
          setWorkProcess(siblingFiber);
          return;
        }
        //如果不存在兄弟节点，向上开始complete
        completedWork = returnFiber
        setWorkProcess(completedWork);
    }while(completedWork)
    //判断是否已经完成
    if (getWorkInProgressRootExitStatus() === RootIncomplete) {
        setWorkInProgressRootExitStatus(RootCompleted)
    }
}
//处理跳过的节点
//简化处理了
export const bailoutOnAlreadyFinishedWork = function(workProcess:Fiber,lane:Lane){
    //如果当前子节点没有更新，直接跳过这部分的更新
    if( !(( workProcess.childrenLane & lane ) !== NotLane) ){
        return null;
    }else {
        //这里缺少一个 cloneChildFibers ,暂时先不实现 观察一下 缺失cloneChildFibers会引发什么问题
        //cloneChildFibers 内容简化
        // 这里需要依靠createWorkProcess 建立alternate的链接,不然初次渲染之后的第二次更新，会读取不到alternate
        if(workProcess.children){
            let currentChild = workProcess.children;
            let newChild = createWorkProcess(currentChild, currentChild.pendingProps);
            workProcess.children = newChild;
            newChild.return = workProcess;
            while (currentChild.sibling !== null) {
              currentChild = currentChild.sibling;
              newChild = newChild.sibling = createWorkProcess(
                currentChild,
                currentChild.pendingProps,
              );
              newChild.return = workProcess;
            }
            newChild.sibling = null;
        }
        //end cloneChildFibers
        return workProcess.children;
    }
}



//更新root节点
export const updateHostRoot = function(current:Fiber,workProcess:Fiber,lane:Lane):Fiber|null{
    const nextProps = workProcess.pendingProps;
    const prevState = workProcess.memoizedState as any;
    const prevChildren = prevState ? prevState.element : null;
    //阻断更新队列引用关系
    cloneUpdateQueue(current,workProcess)
    //处理更新队列
    processUpdateQueue(workProcess,nextProps,null)
    const nextState = workProcess.memoizedState as any
    const nextChildren = nextState.element;
    //如果存在了。直接返回子节点
    if(nextChildren === prevChildren){
        return bailoutOnAlreadyFinishedWork(workProcess,lane)
    }
    //开始调和子节点
    reconcileChildren(current,workProcess,nextChildren)
    return workProcess.children;
}
//更新function节点
export const updateFunctionComponent = function(current:Fiber,workProcess:Fiber,Component:(props?: any) => any,nextProps:any):Fiber|null{
    const nextChildren = renderWithHooks(
        current,
        workProcess,
        Component,
        nextProps,
    );
    reconcileChildren(current, workProcess, nextChildren);
    return workProcess.children;
}
//更新class节点
export const updateClassComponent= function(  current: Fiber | null,workProcess: Fiber,Component: any,nextProps: any,renderLanes: Lane):Fiber|null{  
    const instance = workProcess.stateNode as Component;;
    let shouldUpdate;
    if(!instance){
        if(current){
            current.alternate = null;
            workProcess.alternate = null;
            workProcess.flag |= PlaceEffect;
        }
        constructClassInstance(workProcess, Component, nextProps);
        mountClassInstance(workProcess, Component, nextProps);
        shouldUpdate = true;
    }else if (!current) {
        shouldUpdate = resumeMountClassInstance(workProcess,Component,nextProps);
    }else {
        shouldUpdate = updateClassInstance(current,workProcess,Component,nextProps);
    }
    const nextUnitOfWork = finishClassComponent(
        current,
        workProcess,
        Component,
        shouldUpdate,
        renderLanes
    );
    return nextUnitOfWork
}
//更新悬浮
export const updateSuspenseComponent = function(current:Fiber|null,workProcess:Fiber,lane:Lane):Fiber|null{
    const nextProps = workProcess.pendingProps;
    const didSuspend = (workProcess.flag & DidCaptureEffect) !== NotEffect;
    let showFallback = false;
    //suspenses 上下文暂不实现
    //是否显示 fallback
    if(didSuspend && shouldRemainOnFallback(current,workProcess)){
        //渲染fallback
        showFallback = true;
        workProcess.flag &= ~DidCaptureEffect;
    }else{
        //suspensesContext 上下文 先不实现
    }
    //初次挂载
    if(!current){
        //enableSuspenseServerRenderer 先不实现  ssr
        const nextPrimaryChildren = nextProps.children;
        const nextFallbackChildren = nextProps.fallback;
        if(showFallback){
            //unstable_expectedLoadTime 模式暂不处理
            const fallbackFragment = mountSuspenseFallbackChildren(
                workProcess,
                nextPrimaryChildren,
                nextFallbackChildren,
                lane,
            );
            const primaryChildFragment: Fiber = (workProcess.children as Fiber);
            primaryChildFragment.memoizedState = mountSuspenseOffscreenState(
                lane,
            );
            workProcess.memoizedState = {
                dehydrated: null,
                retryLane: NotLane,
            }
            return fallbackFragment;
        }else{
            return mountSuspensePrimaryChildren(
                workProcess,
                nextPrimaryChildren,
                lane,
            );
        }
    }else{
        const prevState = current.memoizedState;
        if (prevState) {
            if (showFallback) {
                const nextFallbackChildren = nextProps.fallback;
                const nextPrimaryChildren = nextProps.children;
                const fallbackChildFragment = updateSuspenseFallbackChildren(
                    current,
                    workProcess,
                    nextPrimaryChildren,
                    nextFallbackChildren,
                    lane,
                );
                const primaryChildFragment: Fiber = (workProcess.children as any);
                const prevOffscreenState = (current.children as any).memoizedState;
                primaryChildFragment.memoizedState = !prevOffscreenState? mountSuspenseOffscreenState(lane): updateSuspenseOffscreenState(prevOffscreenState, lane);
                primaryChildFragment.childrenLane = getRemainingWorkInPrimaryTree(
                    current,
                    lane,
                );
                workProcess.memoizedState = {
                    dehydrated: null,
                    retryLane: NotLane,
                };
                return fallbackChildFragment;
            } else {
                const nextPrimaryChildren = nextProps.children;
                const primaryChildFragment = updateSuspensePrimaryChildren(
                  current,
                  workProcess,
                  nextPrimaryChildren,
                  lane,
                );
                workProcess.memoizedState = null;
                return primaryChildFragment;
            }
        }else{
            if (showFallback) {
                const nextFallbackChildren = nextProps.fallback;
                const nextPrimaryChildren = nextProps.children;
                const fallbackChildFragment = updateSuspenseFallbackChildren(
                    current,
                    workProcess,
                    nextPrimaryChildren,
                    nextFallbackChildren,
                    lane,
                );
                const primaryChildFragment: Fiber = (workProcess.children as any);
                const prevOffscreenState = (current.children as any).memoizedState;
                primaryChildFragment.memoizedState = !prevOffscreenState? mountSuspenseOffscreenState(lane) : updateSuspenseOffscreenState(prevOffscreenState, lane);
                primaryChildFragment.childrenLane = getRemainingWorkInPrimaryTree(
                    current,
                    lane,
                );
                // Skip the primary children, and continue working on the
                // fallback children.
                workProcess.memoizedState = {
                    dehydrated: null,
                    retryLane: NotLane,
                };
                return fallbackChildFragment;
            }else{
                // Still haven't timed out. Continue rendering the children, like we
                // normally do.
                const nextPrimaryChildren = nextProps.children;
                const primaryChildFragment = updateSuspensePrimaryChildren(
                    current,
                    workProcess,
                    nextPrimaryChildren,
                    lane,
                );
                workProcess.memoizedState = null;
                return primaryChildFragment;
            }
        }
    }
}
//更新组件集合
export function updateFragmentComponent(current: Fiber | null,workProcess: Fiber,renderLanes: Lane,):Fiber|null {
    const nextChildren = workProcess.pendingProps;
    reconcileChildren(current, workProcess, nextChildren,);
    return workProcess.children;
}
//更新隐藏组件件
export function updateOffscreenComponent(current: Fiber | null,workProcess: Fiber,renderLanes: Lane,):Fiber|null {
    const nextProps = workProcess.pendingProps;
    const nextChildren = nextProps.children;
    const prevState = current !== null ? current.memoizedState : null;
    if(nextProps.mode === 'hidden'){
        //ConcurrentMode 先不处理
        if(!((renderLanes & OffscreenLane) !== NotLane)){
            //如果不包含OffscreenLane,说明还没渲染
            let nextBaseLanes;
            if (prevState !== null) {
              const prevBaseLanes = prevState.baseLanes;
              nextBaseLanes = (prevBaseLanes|renderLanes)
            } else {
              nextBaseLanes = renderLanes;
            }
            workProcess.lane = workProcess.childrenLane =OffscreenLane
            const nextState = {
                baseLanes: nextBaseLanes,
            };
            workProcess.memoizedState = nextState; 
            //跳过更新
            pushRenderLanes(workProcess, nextBaseLanes);
            return null;
        }else{
            //Offscreen开始渲染了，最低优先级渲染
            const nextState = {
                baseLanes: NotLane,
            };
            workProcess.memoizedState = nextState;
            //准备跳过分支
            const subtreeRenderLanes = prevState !== null ? prevState.baseLanes : renderLanes;
            pushRenderLanes(workProcess, subtreeRenderLanes);
        }
    }else{
        //显示了要开始渲染了
        let subtreeRenderLanes
        if (prevState !== null) {
            subtreeRenderLanes = prevState.baseLanes|renderLanes;
            workProcess.memoizedState = null;
          } else {
            subtreeRenderLanes = renderLanes;
          }
          pushRenderLanes(workProcess, subtreeRenderLanes);
    }
    reconcileChildren(current, workProcess, nextChildren);
    return workProcess.children;
}
//更新原生dom节点
export const updateHostComponent = function(current:Fiber,workProcess:Fiber):Fiber|null{
    const type = workProcess.type;
    const nextProps = workProcess.pendingProps;
    const prevProps = current !== null ? current.memoizedProps : null;
    let nextChildren = nextProps.children;
    updateRef(current,workProcess);
    // 判断是否是text类型的组件，暂不处理
    // shouldSetTextContent(type,nextProps)
    reconcileChildren(current, workProcess, nextChildren,);
    return workProcess.children;
}
//更新text文本节点
export const updateTextComponent = function(current:Fiber,workProcess:Fiber):Fiber|null{
    //服务端渲染的Hydratable先不处理
    return null;
}
//调和子节点
export const reconcileChildren = function( current: Fiber | null,workInProgress: Fiber,nextChildren: any){
    if(!current){
        workInProgress.children =  mountChildrenFiber(workInProgress,nextChildren)
    }else{
        workInProgress.children =  reconcileChildrenFiber(current,workInProgress,nextChildren)
    }
}
//完成class组件
export const finishClassComponent = function(current:Fiber | null,workProcess: Fiber,Component: any,shouldUpdate: boolean,renderLanes:Lane):Fiber | null{
    updateRef(current,workProcess)
    const instance = workProcess.stateNode as Component;
    const didCaptureError = (workProcess.flag & DidCaptureEffect) !== NotEffect;
    //无更新直接跳过
    if (!shouldUpdate && !didCaptureError) {
        return bailoutOnAlreadyFinishedWork(workProcess, renderLanes);
    }
    var nextChildren
    //如果存在错误,即将重置卸载子组件
    if(didCaptureError){
        nextChildren = null
    }else{
        nextChildren = instance.render();
    }
    reconcileChildren(current, workProcess, nextChildren);
    workProcess.memoizedState = instance.state;
    return workProcess.children;
}


