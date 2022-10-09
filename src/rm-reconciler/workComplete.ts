import { Component } from '../rm-core/classComponent'
import { 
    Fiber,FiberRoot,FiberTag,
    createWorkProcess as createCloneFiber,
    NotEffect,PlaceEffect,UpdateEffect,DeleteEffect,DidCaptureEffect,ShouldCaptureEffect,
    HostRoot,ClassComponent,FunctionComponent,HostComponent,HostText,
    LazyComponent,SuspenseComponent,OffscreenComponent,FragmentComponent,
} from './Fiber'
import { Lane } from './Lane'
import {
    updateHostContainer,
    updateHostComponent,
    updateHostText,
    updateRef,
    appendAllChildren,
    createInstance,
    createTextInstance,
    setInitialDOMProperties,
} from './platform/index'
import { popRenderLanes } from './workLoop'

//还未完成计算
//这个和中断计算有关系，暂时先不做处理
//unwindWork 在这里出堆栈，还没处理context上下文，先不处理这个
export const unwindWork = function(workProcess:Fiber){
    const flags = workProcess.flag;
    switch(workProcess.tag){
        case HostRoot:
            //这里需要pop出堆栈,暂不实现，后续在处理
            workProcess.flag = (flags & ~ShouldCaptureEffect) | DidCaptureEffect;
            return workProcess
        case LazyComponent://懒加载组件,暂不处理
            //这里需要pop出堆栈,暂不实现，后续在处理
            return null;
        case ClassComponent://类组件
            //这里需要pop出堆栈,暂不实现，后续在处理
            //如果存在捕获更新
            if (flags & ShouldCaptureEffect) {
                workProcess.flag = (flags & ~ShouldCaptureEffect) | DidCaptureEffect;
              return workProcess;
            }
            return null
        case SuspenseComponent:
            //这里需要pop出堆栈,暂不实现，后续在处理
            //如果存在捕获更新
            if (flags & ShouldCaptureEffect) {
                workProcess.flag = (flags & ~ShouldCaptureEffect) | DidCaptureEffect;
              return workProcess;
            }
            return null;
        case FunctionComponent://函数组件
            //这里需要pop出堆栈,暂不实现，后续在处理
            return null
        case HostComponent://原生dom
            //这里需要pop出堆栈,暂不实现，后续在处理
            return null
        case HostText://原生文本
            //这里需要pop出堆栈,暂不实现，后续在处理
            return null
    }
}
//完成节点计算
export const completeWork = function(current:Fiber|null,workProcess:Fiber,renderLanes:Lane):any{
    const newProps = workProcess.pendingProps;
    // debugger;
    switch(workProcess.tag){
        case HostRoot: //根组件
            //准备进入commit阶段
            return updateHostContainer(workProcess)
        case LazyComponent:     //懒加载组件   
        case FragmentComponent: //域组件
        case ClassComponent:    //类组件
        case FunctionComponent: //函数组件
            //这几种类型的不处理
            return null;
        case SuspenseComponent:  //悬浮组件
            const nextState = workProcess.memoizedState;
            //如果在捕获错误中
            if((workProcess.flag & DidCaptureEffect) !== NotEffect){
                workProcess.lane = renderLanes;
                return workProcess
            }
            const nextDidTimeout = !!nextState;
            let prevDidTimeout = false;
            if (!current) {
              if (workProcess.memoizedProps.fallback) {
                // popHydrationState(workInProgress); //上下文相关先不实现
              }
            } else {
              const prevState = current.memoizedState;
              prevDidTimeout = !!prevState;
            }
            //是否需要更新
            if (nextDidTimeout || prevDidTimeout) {
                workProcess.flag |= UpdateEffect;
            }
            return null;
        case OffscreenComponent: //缓存组件
            popRenderLanes(workProcess);
            if (current) {
                const nextState= workProcess.memoizedState;
                const prevState= (current as Fiber).memoizedState;
        
                const prevIsHidden = !!prevState;
                const nextIsHidden = !!nextState;
                //如果不相等，则可能需要更新,详细见workProcess
                if (
                    prevIsHidden !== nextIsHidden
                ) {
                    workProcess.flag |= UpdateEffect;
                }
            }
            return null
        case HostComponent://原生dom
            //如果存在,则更新
            if (current && workProcess.stateNode) {
                updateHostComponent(current as Fiber,workProcess,workProcess.type as string,newProps)
                updateRef((current as Fiber),workProcess)
            }else{
                //需要新建
                const instance = createInstance(workProcess.type as string,newProps,workProcess)
                appendAllChildren(instance, workProcess);
                //finalizeInitialChildren 里面 setInitialProperties ,简单实现一下
                setInitialDOMProperties(instance,newProps)
                workProcess.stateNode = instance;
                updateRef(null,workProcess)
            }
            return null;
        case HostText://原生文本
            const newText = newProps;
            //如果存在,则更新
            if (current  && workProcess.stateNode) {
                return updateHostText(current as Fiber,workProcess,(current as Fiber).memoizedProps,newText)
            }else{
                //需要新建
                const instance = createTextInstance(newText as string,workProcess)
                workProcess.stateNode = instance;
                return null
            }
    }
}


