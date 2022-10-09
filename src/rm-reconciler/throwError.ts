import { 
    FiberRoot,Fiber,BlockModel,NoModel,
    SuspenseComponent,
    incompleteEffect,ShouldCaptureEffect, HostRoot, ClassComponent, DidCaptureEffect, NotEffect
} from './Fiber'
import { Component } from '../rm-core/classComponent'
import { Lane,pickArbitraryLane } from './Lane';
import { shouldCaptureSuspense } from './suspenseComponent'
import { createRootErrorUpdate,createClassErrorUpdate,enqueueCapturedUpdate } from './update'
import { 
    getWorkProcess,setWorkProcess,completeUnitOfWork
} from './workProcess'
import{
    getWorkInProgressRootRenderLanes,setWorkInProgressRootRenderLanes,
} from './workLoop'



//处理错误，从错误节点，往父节点进行反推
export const handleError = function(root:FiberRoot, thrownValue:Error){
    do{
        let erroredWork = getWorkProcess();
        try{
            //reset hook等相关的 先不处理
            if (erroredWork === null || erroredWork.return === null) {
                //已经到头了
                setWorkProcess(null);
                return null
            }
            throwException(
                root,
                erroredWork.return,
                erroredWork,
                thrownValue,
                getWorkInProgressRootRenderLanes(),
            );
            completeUnitOfWork(erroredWork);
        }catch(yetAnotherError){
            //如果还有第二次错误,需要向上推进
            thrownValue = yetAnotherError;
            if (getWorkProcess() === erroredWork && erroredWork !== null) {
              //如果已经处理了。那么跳过这个,向上推进
              erroredWork = erroredWork.return;
              setWorkProcess(erroredWork)
            } else {
              erroredWork = getWorkProcess();
            }
            continue;
        }
        return //返回到正常流程
    }while(true)
}


//追踪lazy组件用的,在处理suspenseComponent要添加这个，主要是需要等待lazy loading之后在做处理
const attachPingListener = function(){  
}


//处理抛出异常错误
const throwException = function(root:FiberRoot,returnFiber:FiberRoot|Fiber,sourceFiber:Fiber,throwError:Error,renderLane:Lane){
    //标记节点未完成
    sourceFiber.flag |= incompleteEffect;
    //这个节点树的副作用无效了
    sourceFiber.firstEffect = sourceFiber.lastEffect = null;
    //如果错误是一个promise 那么可能是suspenseComponent
    if (
        throwError !== null &&
        typeof throwError === 'object' &&
        typeof (throwError as any).then === 'function'
    ) {
        // This is a wakeable.
        const wakeable = throwError
        //调度最近的 那么可能是suspenseComponent
        var workProgress = returnFiber as Fiber
        do{
            if(
                workProgress.tag === SuspenseComponent &&
                shouldCaptureSuspense(workProgress)
            ){
                
                //添加到updateQueue里面
                const wakeables: Set<any> = workProgress.updateQueue as any
                if (!wakeables) {
                    const updateQueue = new Set()
                    updateQueue.add(wakeable);
                    workProgress.updateQueue = updateQueue as any;
                } else {
                    wakeables.add(wakeable);
                }
                //BlockModel模式先跳过
                if((workProgress.mode & BlockModel) === NoModel){
                    //BlockModel模式先跳过,暂不处理
                }
                // attachPingListener() lazy组件先接收，先不处理
                // suspense需要在lazy then之后才能处理，这样能接收到正确的参数
                workProgress.flag |= ShouldCaptureEffect;
                workProgress.lane = renderLane;
                return;
            }
            workProgress = workProgress.return as Fiber
        }while(workProgress && !(workProgress instanceof FiberRoot))
    }
    //接下来准备处理 HostRoot 和ClassComponent 这2种类型的错误
    var workProgress = returnFiber  as Fiber
    do{
        let errorInfo
        switch(workProgress.tag){
            case HostRoot:
                errorInfo = throwError;
                workProgress.flag |= ShouldCaptureEffect;
                //lane重新更新，以免在beginWork跳过更新
                const lane = pickArbitraryLane(renderLane);
                workProgress.lane = ( workProgress.lane |  lane) as Lane
                var update = createRootErrorUpdate(workProgress, errorInfo);
                enqueueCapturedUpdate(workProgress, update);
                return;
            case ClassComponent:
                errorInfo = throwError;
                const ctor = workProgress.type as any
                const instance = workProgress.stateNode  as Component
                if(
                  (workProgress.flag & DidCaptureEffect) === NotEffect &&
                    (typeof ctor.getDerivedStateFromError === 'function' ||
                        (instance &&typeof instance.componentDidCatch === 'function')
                )){
                    workProgress.flag |= ShouldCaptureEffect;
                    //lane重新更新，以免在beginWork跳过更新
                    const lane = pickArbitraryLane(renderLane);
                    workProgress.lane = ( workProgress.lane |  lane) as Lane
                    //创建更新
                    var update = createClassErrorUpdate(
                        workProgress,
                        errorInfo,
                    );
                    enqueueCapturedUpdate(workProgress, update);
                  return;
                }
                break;
            default:
                break;
        }
        workProgress = workProgress.return as Fiber
    }while(workProgress)
}


