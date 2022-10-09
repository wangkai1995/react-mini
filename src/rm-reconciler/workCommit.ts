import { Component } from "../rm-core/classComponent";
import {
  FiberRoot,
  Fiber,
  NotEffect,PlaceEffect,CallbackEffect,UpdateEffect,DeleteEffect,SnapshotEffect,HookLayoutEffect,RefEffect,
  HostRoot,ClassComponent,FunctionComponent,HostComponent,HostText,SuspenseComponent,OffscreenComponent,FragmentComponent, LazyComponent
} from "./Fiber";
import { NotLane,markRootUpdated, requestRetryLane, Lane } from './Lane'
import {
  getUpdateContext,
  setUpdateContext,
  CommitContext,
  UpdateQueue
} from "./update";
import {
    scheduler_priorityType,
    runWithPriority,
    scheduler_ImmediatelyPriority,
    getCurrentPriorityLevel,
} from "./schedulerWithReconciler";
import {
  getWorkProcessRoot,
  setWorkProcessRoot,
  setWorkProcess,
} from "./workProcess";
import { setWorkInProgressRootRenderLanes,markUpdateLaneFromFiberToRoot,ensureRootIsScheduled } from './workLoop'
import { 
    appendChild, appendInsertBeforeChild,removeChild,updateDOMProperties,updateFiberProps,
    hideInstance,unhideInstance,hideTextInstance,unhideTextInstance,
} from "./platform/index";
import { SyncLane,markRootFinished,sycLanePriority,notLanePriority, LanePriorityType } from './Lane'
import { schedulePassiveEffects,flushPassiveEffects } from './hookEffect'


var rootDoesHavePassiveEffects = false;
export const getRootDoesHavePassiveEffects = function(){
    return rootDoesHavePassiveEffects
}
export const setRootDoesHavePassiveEffects = function(flag:boolean){
    rootDoesHavePassiveEffects = flag
}
var rootWithPendingPassiveEffects = null;
export const getRootWithPendingPassiveEffects = function(){
    return rootWithPendingPassiveEffects
}
export const setRootWithPendingPassiveEffects = function(root:FiberRoot|null){
    rootWithPendingPassiveEffects = root
}
var pendingPassiveEffectsRenderPriority:scheduler_priorityType = notLanePriority;
export const setPendingPassiveEffectsRenderPriority = function(priority:scheduler_priorityType){
    pendingPassiveEffectsRenderPriority = priority
}
export const getPendingPassiveEffectsRenderPriority = function(){
    return pendingPassiveEffectsRenderPriority
}


export const commitRoot = function(root: FiberRoot) {
  runWithPriority(scheduler_ImmediatelyPriority, () => commitRootImpl(root,getCurrentPriorityLevel()));
};
const commitRootImpl = function(root: FiberRoot,renderPriorityLevel:scheduler_priorityType) {
    do{
        flushPassiveEffects();
    }while(rootDoesHavePassiveEffects)
    //这个和hoot effect有关，先不处理
    const finishedWork = root.finishedWork;
    //如果不存在更新
    if (!finishedWork) {
        return null;
    }
    //准备开始更新
    root.finishedWork = null;
    //清除还挂载的任务
    root.callback = null;
    let remainingLanes = (finishedWork.lane | finishedWork.childrenLane) as Lane
    markRootFinished(root, remainingLanes);
    // 清空work
    if (root === getWorkProcessRoot()) {
        setWorkProcessRoot(null);
        setWorkProcess(null);
        setWorkInProgressRootRenderLanes(NotLane)
    }
    //获取副作用链接
    let firstEffect;
    if (finishedWork.flag > NotEffect) {
        //如果当前root有更新，需要从当前root算起
        if (finishedWork.lastEffect) {
            finishedWork.lastEffect.nextEffect = finishedWork;
            firstEffect = finishedWork.firstEffect;
        } else {
            firstEffect = finishedWork;
        }
    } else {
        firstEffect = finishedWork.firstEffect;
    }
    //开始执行 commit更新副作用
    if (firstEffect) {
        let nextEffect;
        //进入更新阶段
        let executionContext = getUpdateContext();
        const prevExecutionContext = executionContext;
        executionContext |= CommitContext;
        setUpdateContext(executionContext);
        //开始执行 BeforeMutation阶段
        nextEffect = firstEffect;
        try {
            commitBeforeMutationEffects(nextEffect);
        } catch (e) {
            //捕获错误更新方式先不处,错误和suspension组件相关
            throw new Error(e);
        }
        //开始执行 Mutation阶段
        nextEffect = firstEffect;
        try {
            commitMutationEffects(nextEffect);
        } catch (e) {
            //捕获错误更新方式先不处,错误和suspension组件相关
            throw new Error(e);
        }
        //已经更新完成了 切换当前分支
        root.current = finishedWork;
        //开始执行 layout阶段
        nextEffect = firstEffect;
        try {
            commitLayoutEffects(nextEffect);
        } catch (e) {
            //捕获错误更新方式先不处,错误和suspension组件相关
            throw new Error(e);
        }
        //reset
        setUpdateContext(prevExecutionContext);
    }else{
        //无更新 切换当前分支
        root.current = finishedWork;
        console.error('无更新切换当前分支,应该存在无修改的错误更新')
    }

    //如果当前存在副作用
    if(rootDoesHavePassiveEffects){
        rootDoesHavePassiveEffects = false;
        rootWithPendingPassiveEffects = root;
        pendingPassiveEffectsRenderPriority = renderPriorityLevel;
    }

    //检查剩余任务相关的和lane有关系，先不处理
};
//更新前副作用
const commitBeforeMutationEffects = function(nextEffect: Fiber) {
  while (nextEffect) {
    const current = nextEffect.alternate;
    //如果需要更新前快照生命周期
    if (nextEffect.flag & SnapshotEffect) {
      //只有2个组件类型有需要处理
      switch (nextEffect.tag) {
        //根组件
        case HostRoot:
          //根组件暂不处理
          break;
        //class组件
        case ClassComponent:
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          const instance = nextEffect.stateNode as Component;
          const snapshot = instance.getSnapshotBeforeUpdate(
            prevProps,
            prevState
          );
        //暂不使用快照
        default:
          break;
      }
    }
    nextEffect = nextEffect.nextEffect;
  }
};
//更新中
const commitMutationEffects = function(nextEffect: Fiber) {
  while (nextEffect) {
    const flag = nextEffect.flag;
    //先删除旧的Ref
    if(flag & RefEffect){
        const current = nextEffect.alternate;
        if (current) {
            commitDetachRef(current);
        }
    }
    const effect = flag & (PlaceEffect | UpdateEffect | DeleteEffect);
    if (effect !== NotEffect) {
        switch (effect) {
            case PlaceEffect:
                commitPlace(nextEffect);
                //放置有可能后续还有更新
                nextEffect.flag &= ~PlaceEffect;
                break;
            case UpdateEffect:
                commitWork(nextEffect);
                break;
            case DeleteEffect:
                //还要执行相关的生命周期
                commitDelete(nextEffect);
                break;
        }
    }
    nextEffect = nextEffect.nextEffect;
  }
};
//更新结束layout阶段
const commitLayoutEffects = function(nextEffect: Fiber) {
    while (nextEffect) {
        const flag = nextEffect.flag;
        
        if(flag & (UpdateEffect|CallbackEffect) ){
            //commitLayoutEffectOnFiber 简化处理
            const tag = nextEffect.tag
            switch(tag){
                case HostRoot:
                    var updateQueue = nextEffect.updateQueue as any
                    if(updateQueue){
                        commitUpdateQueue(nextEffect,updateQueue,nextEffect.stateNode as FiberRoot)
                    }
                    break;
                case ClassComponent:
                    const instance = nextEffect.stateNode as Component;
                    if(nextEffect.alternate){
                        if(instance.componentDidUpdate && typeof instance.componentDidUpdate  === 'function' ){
                            instance.componentDidUpdate();
                        }
                    }else{
                        if(instance.componentDidMount && typeof instance.componentDidMount  === 'function' ){
                            instance.componentDidMount();
                        }
                    }
                    var updateQueue = nextEffect.updateQueue as any
                    if(updateQueue){
                        commitUpdateQueue(nextEffect,updateQueue,nextEffect.stateNode as Component)
                    }
                    break;
                case FunctionComponent:
                    //执行effect hook
                    if((nextEffect.flag & HookLayoutEffect ) == HookLayoutEffect){
                        try{
                            commitHookEffectListMount(nextEffect)
                        }catch(e){}
                    }
                    break
            }
        }
        if(flag & RefEffect){
            commitAttachRef(nextEffect)
        } 

        nextEffect = nextEffect.nextEffect;
    }
};





const commitHookEffectListMount = function(nextEffect:Fiber){
    const updateQueue = nextEffect.updateQueue as any
    if(updateQueue){
        const lastEffect = updateQueue.lastEffect
        if(!lastEffect) return ;
        var firstEffect = lastEffect
        var effect = firstEffect.next
        do{
            const { tag, create } = effect
           if((tag & HookLayoutEffect ) === HookLayoutEffect ){
               effect.destory = create();
           }
           effect = effect.next;
        }while(effect && effect!==firstEffect)
    }
}
const commitHookEffectListUnmount = function(nextEffect:Fiber){
    const updateQueue = nextEffect.updateQueue as any
    if(updateQueue){
        const lastEffect = updateQueue.lastEffect
        if(!lastEffect) return ;
        var firstEffect = lastEffect
        var effect = firstEffect.next
        do{
            const { tag, destory } = effect
            if((tag & HookLayoutEffect ) === HookLayoutEffect && destory ){
                destory();
            }
            effect = effect.next;
        }while(effect && effect!==firstEffect)
    }
}
const commitSuspenseComponent = function(current:Fiber){
    const newState = current.memoizedState;
    if (newState) {
        //隐藏当前子节点
        const primaryChildParent: Fiber = current.children;
        hideOrUnhideAllChildren(primaryChildParent, true);
    }
    //enableSuspenseCallback 相关先不实现
}
const commitPlace = function(current: Fiber) {
    var hostParentFiber = getHostParentFiber(current)
    var parent = null;
    switch (hostParentFiber.tag) {
        case HostRoot:
            parent = (hostParentFiber.stateNode as FiberRoot).container;
            hostParentFiber = (hostParentFiber.stateNode as FiberRoot).current;
            break;
        case HostText:
        case HostComponent:
            parent = hostParentFiber.return;
            while (
                parent.tag === ClassComponent ||
                parent.tag === FunctionComponent ||
                parent.tag === HostRoot
            ) {
                if (parent.tag === HostRoot) {
                    break;
                } else {
                    parent = parent.return;
                }
            }
            if (parent.tag === HostRoot) {
                parent = parent.stateNode.container;
            } else {
                parent = parent.stateNode;
            }
            break;
        default:
        throw new Error(
            "commitRoot is commitPlace function exe error : not find parent"
        );
    }
    var before = hostParentFiber.sibling;
    while (before) {
        if (
            (before.tag === HostText || before.tag === HostComponent) &&
            (before.flag & PlaceEffect) !== NotEffect
        ) {
            break;
        }
        if (before.sibling) {
            before = before.sibling;
            continue;
        }
        if (before.children) {
            before = before.children;
            continue;
        }
        break;
    }
    //add child
    insertOrAppendPlacementNode(current, parent, before);
};
const commitWork = function(current:Fiber){
    const tag = current.tag
    switch (tag) {
        case ClassComponent:
            return ;
        case FunctionComponent:
            //执行unEffect hook
            if((current.flag & HookLayoutEffect ) == HookLayoutEffect){
                commitHookEffectListUnmount(current)
            }
            break;
        case OffscreenComponent:
            const newState = current.memoizedState;
            const isHidden = !!newState;
            hideOrUnhideAllChildren(current, isHidden);
            break;
        case SuspenseComponent:
            commitSuspenseComponent(current)
            attachSuspenseRetryListeners(current)
            break
        case HostComponent:
            commitUpdate(current)
            break;
        case HostText:
            commitTextUpdate(current)
            break;
    }
    schedulePassiveEffects(current)
}
const commitUpdate = function(current: Fiber) {
    const updateQueue:Array<any> = current.updateQueue as any;
    const node = current.stateNode as HTMLElement;
    //简化了updateDOMProperties
    for(var i=0;i<updateQueue.length; i+=2){
        var propsKey = updateQueue[i]
        var propsValue = updateQueue[i+1];
        updateDOMProperties(node,propsKey,propsValue)
    }
    //更新props,主要用来合成事件的时候读取
    updateFiberProps(node,current.memoizedProps);
};
const commitTextUpdate = function(current:Fiber){
    const { memoizedProps } = current
    const node = current.stateNode as Text
    node.nodeValue = memoizedProps;
};
const commitAttachRef = function(finishedWork: Fiber){
    const ref = finishedWork.ref as any
    if (ref !== null) {
        const instance = finishedWork.stateNode;
        let instanceToUse;
        switch (finishedWork.tag) {
            case HostComponent:
                instanceToUse = instance;
                break;
            default:
                instanceToUse = finishedWork.stateNode;
        }
        if (typeof ref === 'function') {
            ref(instanceToUse);
        } else {
            ref.current = instanceToUse;
        }
    }
}
const commitDetachRef = function(current: Fiber){
    const currentRef = current.ref as any
    if (currentRef !== null) {
        if (typeof currentRef === 'function') {
            currentRef(null);
        } else {
            currentRef.current = null;
        }
    }
}
const commitUnmount = function(current:Fiber){
    switch(current.tag){
        case FunctionComponent:
            commitHookEffectListUnmount(current)
            break;
        case ClassComponent:
            const instance = current.stateNode as Component;
            if(instance.componentWillUnmount && typeof instance.componentWillUnmount === 'function'){
                instance.componentWillUnmount();
            }
            break;
    }
}
const commitDelete = function(current: Fiber) {
    var findParent = (node: Fiber)=>{
        var parent = null;
        switch (node.tag) {
            case HostRoot:
                parent = (node as any).container;
                break;
            case HostText:
            case HostComponent:
                parent = node.return;
                while (
                    parent.tag === ClassComponent ||
                    parent.tag === FunctionComponent ||
                    parent.tag === OffscreenComponent ||
                    parent.tag === FragmentComponent ||
                    parent.tag === SuspenseComponent ||
                    parent.tag === LazyComponent ||
                    parent.tag === HostRoot
                ) {
                    if (parent.tag === HostRoot) {
                        break;
                    } else {
                        parent = parent.return;
                    }
                }
                if (parent.tag === HostRoot) {
                    parent = parent.stateNode.container;
                } else {
                    parent = parent.stateNode;
                }
                break;
            default:
                throw new Error(
                    "commitRoot is commitPlace function exe error : not find parent"
                );
        }
        return parent
    }
    //卸载当前他自己和所有子节点
    var node = current
    while(true){
        if(node.tag === HostComponent || node.tag === HostText){
            let currentParent = findParent(node)
            removeChild(currentParent,node)
        }else{
            //component 需要卸载,触发一些生命周期
            commitUnmount(node)
        }
        //继续向下卸载
        if(node.children){
            node.children.return = node
            node = node.children;
            continue;
        }
        if(node == current){
            return ;
        }
        //如果卸载的是component节点，要完全遍历删除完
        while (node.sibling === null) {
            if (node.return === null || node.return === current) {
              return;
            }
            node = node.return as Fiber;
        }
        node.sibling.return = node.return;
        node = node.sibling;
    }
};
const commitUpdateQueue = function( finishedWork: Fiber,finishedQueue:UpdateQueue,instance: any){
    const effects = finishedQueue.effects;
    finishedQueue.effects = null;
    if (effects !== null) {
        for (let i = 0; i < effects.length; i++) {
            const callback = effects[i];
            if (callback) {
                callback.call(instance)
            }
        }
    }
}



//隐藏dom，但不是卸载
const hideOrUnhideAllChildren = function(finishedWork: Fiber,isHidden:boolean){
    let node: Fiber = finishedWork;
    while (true) {
        if (node.tag === HostComponent) {
            const instance = node.stateNode as HTMLElement
            if (isHidden) {
                hideInstance(instance);
            } else {
                unhideInstance(instance, node.memoizedProps);
            }
        } else if (node.tag === HostText) {
            const instance = node.stateNode as Text
            if (isHidden) {
                hideTextInstance(instance);
            } else {
                unhideTextInstance(instance, node.memoizedProps);
            }
        } else if (
            (node.tag === OffscreenComponent) &&
            (node.memoizedState) !== null &&
            node !== finishedWork
        ) {
            //嵌套Offscreen 不处理
        } else if (node.children !== null) {
            node.children.return = node;
            node = node.children;
            continue;
        }
        if (node === finishedWork) {
            return;
        }
        while (node.sibling === null) {
            if (node.return === null || node.return === finishedWork) {
                return;
            }
            node = node.return as Fiber;
        }
        node.sibling.return = node.return;
        node = node.sibling;
    }
}
//监听suspense重新渲染
const attachSuspenseRetryListeners = function(finishedWork: Fiber){
    const wakeables: Set<Promise<any>>  = (finishedWork.updateQueue as any);
    if (wakeables) {
        finishedWork.updateQueue = null;
        let retryCache = (finishedWork.stateNode as Set<Promise<any>>);
        if (!retryCache) {
            retryCache = finishedWork.stateNode = new Set()
        }
        wakeables.forEach(wakeable => {
            // Memoize using the boundary fiber to prevent redundant listeners.
            let retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
            if (!retryCache.has(wakeable)) {
                retryCache.add(wakeable);
                wakeable.then(retry, retry);
            }
        });
    }
}
const resolveRetryWakeable = function(boundaryFiber: Fiber, wakeable: Promise<any>){
    let retryLane:Lane = NotLane; // Default
    let retryCache:Set<Promise<any>> ;
    retryCache = boundaryFiber.stateNode as Set<Promise<any>>
    if (retryCache !== null) {
      // The wakeable resolved, so we no longer need to memoize, because it will
      // never be thrown again.
      retryCache.delete(wakeable);
    }
    // retryTimedOutBoundary实现;
    if (retryLane === NotLane) {
        retryLane = requestRetryLane(boundaryFiber);
    }
    //开始重新渲染
    const root = markUpdateLaneFromFiberToRoot(boundaryFiber, retryLane);
    if (root !== null) {
        markRootUpdated(root, retryLane);
        ensureRootIsScheduled(root);
    }
}
//获取存在host的节点
const getHostParentFiber = function(fiber:Fiber):Fiber{
    var parentFiber = fiber.return
    while(parentFiber){
        if(parentFiber.tag === HostComponent || parentFiber.tag === HostRoot){
            return parentFiber
        }
        parentFiber = parentFiber.return
    }
    throw new Error('getHostParentFiber not find hostParentFiber')
}
//插入节点
const insertOrAppendPlacementNode = function(node: Fiber, parent, before?){
    const { tag } = node;
    const isHost = tag === HostComponent || tag === HostText;
    if(isHost){
        if (before) {
            appendInsertBeforeChild(parent, node, before);
        } else {
            appendChild(parent, node);
        }
    }else{
        //其他组件,需要向下寻找 
        const child = node.children;
        if (child !== null) {
            insertOrAppendPlacementNode(child, parent, before);
            let sibling = child.sibling;
            while (sibling !== null) {
                insertOrAppendPlacementNode(child, parent, before);
                sibling = sibling.sibling;
            }
        }
    }
}
