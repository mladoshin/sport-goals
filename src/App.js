import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux'
import { Switch, Route, Redirect, BrowserRouter, withRouter } from "react-router-dom";
import { createMuiTheme, ThemeProvider } from '@material-ui/core';

import HomePage from './pages/homePage'
import SignInPage from './pages/signin'
import SignUpPage from './pages/signup'
import DashboardPage from './pages/dashboard'
import ResetPage from './pages/resetPage'
import AllGoalsPage from './pages/allGoalsPage'
import CategoryPage from './pages/categoryPage'
import GoalPage from './pages/goalPage'

import './App.css';
import ErrorPage from './pages/errorPage';

import firebase from './firebase/firebase'


function App(props) {
  const [userTheme, setUserTheme] = useState(false) //light - false, dark - true
  const [isFirebaseInit, setIsFirebaseInit] = useState(false)
  
  useEffect(() => {
    if (!isFirebaseInit) {
      firebase.isInit().then(val => {
        setIsFirebaseInit(true)
        //console.log(firebase.auth.currentUser)
        if (firebase.getCurrentUserId()) {
          props.setUser({ id: firebase.getCurrentUserId(), name: firebase.auth.currentUser.displayName, email: firebase.auth.currentUser.email, auth: true})
          firebase.loadUserGoals(props.loadGoals, props.loadCategories) //load all goals
          props.loadAvatar(firebase.auth.currentUser.photoURL) //load avatar
          firebase.loadNotifications(props.loadNotifications) //load notifications
        } else {
          props.setUser({ id: firebase.getCurrentUserId(), auth: false })
        }

      })
    }
  }, [isFirebaseInit])
  
  console.log(props.goalCategories)


  const DarkTheme = createMuiTheme({
    palette: {
      type: "dark"
    }
  })

  const LightTheme = createMuiTheme({
    palette: {
      type: "light"
    }
  })

  return (
    <ThemeProvider theme={props.theme === "dark" ? DarkTheme : LightTheme}>
      <BrowserRouter>
        <Switch>

          <Route exact path="/home" component={HomePage} />
          <Redirect exact from="/" to="/home" />
          <Route path="/signin" render={() => <SignInPage setUser={props.setUser} />} />
          <Route path="/signup" render={()=><SignUpPage setUser={props.setUser}/>} />
          <Route exact path="/dashboard/userId=:userid" component={DashboardPage} />
          <Route exact path="/dashboard/userId=:userid/goals/filter=:filter" component={AllGoalsPage} />  {/* Review of all categories, all goals or upcoming deadlines overall*/}
          <Route exact path="/dashboard/userId=:userid/goals/:category/filter=:filter" component={CategoryPage} />  {/* Review of the category*/}
          <Route exact path="/dashboard/userId=:userid/goals/:category/goalId=:goalid" component={GoalPage} />  {/* Review of the specific goal or in the same category*/}
          <Route path="/reset-password" component={ResetPage} />
          <Route
            render={
              () => (<ErrorPage error={{ code: "404", message: "Page not found!" }} />) 
            }
          />

        </Switch>
      </BrowserRouter>
    </ThemeProvider>

  );
}

function loadUserGoals(loadGoalItems, loadCategories){
  
  var starCountRef = firebase.db.ref(firebase.getCurrentUserId()+"/goals/").orderByKey();
    starCountRef.on('value', function(snapshot) {
      var goalItems = [] //local temp variable
      var goalCategories = {}
      var identificators = Object.keys(snapshot.val())
      var i = 0

      snapshot.forEach(function (snapItem){
        const item = snapItem.val();
        item.id = identificators[i]
        goalItems.push(item)

        if(goalCategories[item.category]===undefined){
          goalCategories[item.category] = {count: 0}
        }
        goalCategories[item.category].count++
        //console.log("Count: "+goalCategories[item.category].count)
        //console.log(goalCategories)

        i++
      });

      //goalCategories = Array.from(new Set(goalCategories))

      //load json of all photos from database into redux state
      loadGoalItems(goalItems)
      loadCategories()
    });
}

const mapStateToProps = state => {
  return {
    theme: state.theme,
    goals: state.goals,
    goalCategories: state.goalCategories,
    user: state.user,
    avatar: state.userAvatar
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setUser: (obj) => dispatch({ type: "USER/LOADINFO", payload: obj }),
    loadGoals: (arr) => dispatch({type: "GOALS/LOAD", payload: arr}),
    loadCategories: (obj) => dispatch({type: "GOALS/CATEGORY/LOAD", payload: obj}),
    loadAvatar: (url)=>dispatch({type: "AVATAR/LOAD", payload: url}),
    loadNotifications: (arr)=>dispatch({type: "NOTIFICATION/LOAD", payload: arr})
  }
}


export default connect(mapStateToProps, mapDispatchToProps)(App);
