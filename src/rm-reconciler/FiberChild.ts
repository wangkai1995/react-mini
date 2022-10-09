import { 
    Fiber,FiberRoot,FiberTag,createFiberTag,
    HostText,
    NotEffect,PlaceEffect,UpdateEffect,DeleteEffect,SnapshotEffect
} from './Fiber'
import { createWorkProcess } from './workProcess'
import { isArray,isNumber,isString } from '../share/tool';
import { reactElementType } from '../share/type';


export const mountChildrenFiber = function(workInProgress: Fiber,element: any):Fiber{
    //暂时就这三种，component,string|number,array
    const isObjectChildren = typeof element === 'object' && element; 
    const isTextChildren = typeof element === 'string' || typeof element === 'number';
    const isArrayChildren = isArray(element)
    if(isArrayChildren){
        return reconcileChildrenFiberArray(workInProgress,null,element)
    }else if(isTextChildren){
        return reconclieChildrenFiberTextNode(workInProgress,null,element)
    }else if(isObjectChildren){
        return reconclieChildrenFiberElement(workInProgress,null,element)
    }
}
export const reconcileChildrenFiber = function(current: Fiber,workInProgress: Fiber,element: any):Fiber|null{
    //暂时就这三种，component,string|number,array
    const isObjectChildren = typeof element === 'object' && element; 
    const isTextChildren = typeof element === 'string' || typeof element === 'number';
    const isArrayChildren = isArray(element)
    if(isArrayChildren){
        return reconcileChildrenFiberArray(workInProgress,current.children,element)
    }else if(isTextChildren){
        return placeNewChild(reconclieChildrenFiberTextNode(workInProgress,current.children,element))
    }else if(isObjectChildren){
        return placeNewChild(reconclieChildrenFiberElement(workInProgress,current.children,element))
    }
    return deleteChildren(workInProgress,current.children,true)
}



export const reconcileChildrenFiberArray = function(returnFiber:Fiber,childrenFiber:Fiber|null,newChildren:any[]):Fiber{
    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    let oldFiber = childrenFiber;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;
    //计算对比当前差异
    for(;oldFiber && newIdx < newChildren.length; newIdx++ ){
        //如果旧的数据多余新的数据
        if (oldFiber.index > newIdx) {
            nextOldFiber = oldFiber;
            oldFiber = null;
        } else {
            nextOldFiber = oldFiber.sibling;
        }
        //创建新的fiber
        const newFiber = useSlot(returnFiber,oldFiber,newChildren[newIdx])
        //为空则说明存在删除节点
        if (!newFiber ) {
            if (!oldFiber) {
                oldFiber = nextOldFiber;
            }
            break;
        }
        //删除旧的节点
        if (childrenFiber) {
            if (oldFiber && !newFiber.alternate) {
              deleteChildren(returnFiber, oldFiber);
            }
        }
        //设置一下新的放置位置
        lastPlacedIndex = placeChildren(childrenFiber,newFiber, lastPlacedIndex, newIdx);
        //记录开头的节点,和上一个节点
        if (!previousNewFiber) {
            resultingFirstChild = newFiber;
        } else {
            previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
        oldFiber = nextOldFiber;
    }
    //没有新增和需要删除的
    if (newIdx === newChildren.length) {
        if (childrenFiber) {
            deleteChildren(returnFiber, oldFiber,true);
        }
        return resultingFirstChild;
    }
    //如果有新增的
    if (!oldFiber) {
        for (; newIdx < newChildren.length; newIdx++) {
            if(typeof newChildren[newIdx] === 'number' || typeof newChildren[newIdx]  === 'string'){
                newFiber = createText(returnFiber,newChildren[newIdx])
            }else{
                newFiber = createElement(returnFiber,newChildren[newIdx]);
            }
            if (!newFiber) {
                continue;
            }
            lastPlacedIndex = placeChildren(childrenFiber,newFiber, lastPlacedIndex, newIdx);
            if (!previousNewFiber) {
                // TODO: Move out of the loop. This only happens for the first run.
                resultingFirstChild = newFiber;
            } else {
                previousNewFiber.sibling = newFiber;
            }
            previousNewFiber = newFiber;
        }
        return resultingFirstChild;
    }
    //不用index,使用key的情况
    const mapChildren = new Map()
    var currentMapChildren = childrenFiber
    while(currentMapChildren){
        if(currentMapChildren.key){
            mapChildren.set(currentMapChildren.key,currentMapChildren)
        }else{
            mapChildren.set(currentMapChildren.index,currentMapChildren)
        }
        currentMapChildren = currentMapChildren.sibling;
    }
    //在遍历一次新的数组，处理key的情况
    for (; newIdx < newChildren.length; newIdx++) {
        const newChild = newChildren[newIdx]
        var newFiber
        if(typeof newChild === 'number' || typeof newChild === 'string'){
            const matchedFiber = mapChildren.get(newIdx) || null;
            newFiber = updateText(returnFiber,matchedFiber,newChild)
        }else if(newChild){
            const matchedFiber =mapChildren.get(!newChild.key ? newIdx : newChild.key,) || null;
            newFiber = updateElement(returnFiber,matchedFiber,newChild)
        }
        if (newFiber) {
            if (childrenFiber) {
                if (newFiber.alternate) {
                    mapChildren.delete(
                        !newFiber.key ? newIdx : newFiber.key,
                    );
                }
            }
            lastPlacedIndex = placeChildren(childrenFiber,newFiber, lastPlacedIndex, newIdx);
            if (!previousNewFiber) {
                resultingFirstChild = newFiber;
            } else {
                previousNewFiber.sibling = newFiber;
            }
            previousNewFiber = newFiber;
        }
    }
    //如果是更新
    if (childrenFiber) {
        mapChildren.forEach(child => deleteChildren(returnFiber, child));
    }
    return resultingFirstChild;
}
export const reconclieChildrenFiberTextNode = function(returnFiber:Fiber,childrenFiber:Fiber|null,text:any):Fiber{
    if (childrenFiber && childrenFiber.tag === HostText) {
        // We already have an existing node so let's just update it and delete
        // the rest.
        deleteChildren(returnFiber, childrenFiber.sibling,true);
        const existing = useFiber(childrenFiber, text);
        existing.return = returnFiber;
        return existing;
    }
    //挂载情况下不删除
    if(childrenFiber){
        deleteChildren(returnFiber, childrenFiber,true);
    }
    const created = new Fiber(HostText,returnFiber.mode);
    created.pendingProps = text;
    created.return = returnFiber;
    return created;
}
export const reconclieChildrenFiberElement = function(returnFiber:Fiber,childrenFiber:Fiber|null,element:any):Fiber{
    //先删除旧的,在处理新的
    const key = element.key || null;
    let child = childrenFiber;
    //如果有多个那么都要删除掉
    while(child){
        if (child.key === key && child.type === element.type) {
            if(childrenFiber){
                deleteChildren(returnFiber, child.sibling, true);
            }
            const existing = useFiber(child, element.props);
            existing.ref = coerceRef(child, element);
            existing.return = returnFiber;
            return existing;
        }else{
            if(childrenFiber){
                deleteChildren(returnFiber, child, true);
            }
        }
        child = child.sibling;
    }
    //删除剩下多余的
    if (childrenFiber) {
        deleteChildren(returnFiber, child,true);
    }
    //新建
    const created = useSlot(returnFiber,childrenFiber,element)
    return created;
}



export const coerceRef = function(fiber:Fiber,element:reactElementType){
    const mixedRef = element.ref;
    return mixedRef
}
export const useSlot = function(returnFiber:Fiber,childFiber:Fiber,newChild:any){
    var created
    if(typeof newChild === 'number' || typeof newChild === 'string'){
        created = updateText(returnFiber,childFiber,newChild)
    }else if(newChild){
        created = updateElement(returnFiber,childFiber,newChild)
    }
    return created;
}
export const useFiber = function(fiber:Fiber,nextProps:any){
        const clone = createWorkProcess(fiber)
        clone.pendingProps =  nextProps
        clone.index = 0;
        clone.sibling = null;
        return clone;
}
export const placeNewChild = function(newFiber:Fiber){
    if(!newFiber.alternate){
        newFiber.flag = PlaceEffect;
    }
    return newFiber
}
export const createElement = function(returnFiber: Fiber,newChild:any){
    const created = new Fiber(createFiberTag(newChild),returnFiber.mode,newChild);
    created.pendingProps = newChild.props;
    created.return = returnFiber
    return created
}
export const updateElement = function(returnFiber:Fiber,childFiber:Fiber,newChild:any):Fiber{
    if(childFiber){
        if(childFiber.type === newChild.type){
            const existing = useFiber(childFiber, newChild.props);
            existing.ref = coerceRef(childFiber, newChild);
            existing.return = returnFiber
            return existing
        }
    }
    const created = createElement(returnFiber,newChild)
    created.ref = coerceRef(childFiber, newChild);
    created.return = returnFiber
    return created
}
export const createText = function(returnFiber:Fiber,newChild:any){
    const created = new Fiber(HostText,returnFiber.mode);
    created.pendingProps = newChild;
    created.return = returnFiber
    return created
}
export const updateText = function(returnFiber:Fiber,childFiber:Fiber,newChild:any):Fiber{
    if (!childFiber || childFiber.tag !== HostText) {
        // Insert
        const created = createText(returnFiber,childFiber);
        return created;
      } else {
        // Update
        const existing = useFiber(childFiber, newChild);
        existing.return = returnFiber;
        return existing;
      }
}
export const placeChildren = function(currentFiber:Fiber|null,fiber:Fiber,lastIndex:number,newIndex:number):number{
    fiber.index = newIndex;
    if(!currentFiber){
        return lastIndex
    }
    const current = fiber.alternate;
    if (current) {
        //移动位置
        const oldIndex = current.index;
        if (oldIndex < lastIndex) {
            fiber.flag = PlaceEffect;
            return lastIndex;
        } else {
            return oldIndex;
         }
    } else {
        //插入
        fiber.flag = PlaceEffect;
        return lastIndex;
    }
}
export const deleteChildren = function(returnFiber:Fiber,childFiber:Fiber,all?:boolean){
    let childToDelete = childFiber;
    if(!childToDelete) return null;
    do{
        const last = returnFiber.lastEffect;
        if (last) {
          last.nextEffect = childToDelete;
          returnFiber.lastEffect = childToDelete;
        } else {
          returnFiber.firstEffect = returnFiber.lastEffect = childToDelete;
        }
        childToDelete.nextEffect = null;
        childToDelete.flag = DeleteEffect;
        //next
        childToDelete = childToDelete.sibling;
    }while(childToDelete && all)
    return null;
}

