
import React from '../src/rm-core/index'
import reactMiniDom from '../src/rm-dom/index'

// import React from 'react'
// import reactMiniDom from 'react-dom'
// import { createRoot } from "react-dom/client";

const suspenseWrapFetch = (fetchPromise) => {
    var result;
    var error;
    const defend = fetchPromise
      .then((fetchResult) => {
        result = fetchResult;
      })
      .catch((e) => {
        error = e;
      });
    return () => {
        defend;
      if (result) {
        return result;
      }
      if (error) {
        throw error;
      }
      throw defend;
    };
  };
const fetch = () => new Promise((res, rej) => {
    // setTimeout(() => {
    //     debugger;
    //     res(1111);
    // }, 3000);
});
const fetchContent = suspenseWrapFetch(fetch());


const { Suspense } = React

const Success = () => {
    debugger
    const data = fetchContent();
    return <div>sucess:{data}</div>;
};





function SubTest (){
    let [src,setSrc] = React.useState('');
    let [cout,setCount] = React.useState(1);
    let [xy,setXY] = React.useState([0,0]);
    React.useLayoutEffect(()=>{
        setSrc('https://img.jiguang.cn/jiguang/20201012/assets/img/new-logo/logo.svg')
    },[src])
    return <div>
        {cout}
        <img src={src} alt="" onClick={()=>{
            setCount(cout+1)
        }} />
        <p onMouseMove={(event)=>{
                setXY([event.clientX,event.clientY])
            }}>
            {xy[0]}.{xy[1]}
        </p>
    </div>
}

class ClassTest extends React.Component {
    state={
        count:1,
        list:new Array(5000).fill(1)
    }
    testRef = null
    componentDidMount(){
        const time = setInterval(()=>{
            if(this.testRef){
                this.testRef.click()
            }
            const { count } = this.state
            if(count>15){
                clearInterval(time)
            }
        },1000)
        // setTimeout(()=>{
        //     this.setState({count:2},()=>{console.log(this.state.count)})
        //     console.log(this.state.count)
        //     this.setState({count:3},()=>{console.log(this.state.count)})
        //     console.log(this.state.count)
        //     this.setState({count:4},()=>{console.log(this.state.count)})
        //     console.log(this.state.count)
        //     this.setState({count:5},()=>{console.log(this.state.count)})
        //     console.log(this.state.count)
        // },1000)
    }
    componentDidCatch(error){
        console.log('componentDidCatch recive',error)
    }
    testClick(){
        const { count } = this.state
        this.setState({
            list:this.state.list.map(e=>e+1),
            count:count+1,
        })
    }
    render(){
        const { count,list } = this.state;
        return <div ref={ref=>this.testRef=ref} onClick={()=>this.testClick()}>
            {count}
            <SubTest />
            <ul>
                {list.map(e=><li>{e}</li>)}
            </ul>
        </div>
    }
}

function Test (){
    return <div id="1">
        {/* <Suspense fallback={<p>loading</p>}>
            <Success/>
        </Suspense> */}
        <ClassTest/>
    </div>
}


// reactMiniDom.render(<Test />,document.getElementById('root'))
// reactMiniDom.createBlockingRoot(document.getElementById('root')).render(<Test />)
reactMiniDom.createRoot(document.getElementById('root')).render(<Test />)



// const test = createRoot(document.getElementById('root'))
// test.render(<Test />)
