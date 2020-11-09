const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

database = admin.database();

// User created trigger

exports.userCreated = functions.auth.user().onCreate(user => {
    console.log("Email: " + user.email);
    if (!user.emailVerified) {
        database.ref("/" + user.uid + "/notifications/").push({
            type: "VERIFICATION",
            date: Date.now(),
            text: "Verify your email to use app functionality."
        })

        try {
            database.ref("/" + user.uid + "/general/").set({
                name: user.displayName,
                emailVerified: user.emailVerified,
                email: user.email,
                avatar: user.photoURL
            })
        } catch (err) {
            console.log(err.message)
        }

    } else {
        return user;
    }

})

// User deleted trigger

exports.userDeleted = functions.auth.user().onDelete(user => {
    console.log("Email: " + user.email);
    return database.ref("/" + user.uid + "/").remove()
})

// goal updated trigger
exports.goalUpdated = functions.database.ref('/{userId}/goals/{goalId}/')
    .onUpdate((change, context) => {
        // Only edit data when it is first created.
        const userId = context.params.userId;
        const goalId = context.params.goalId;
        const newValue = change.after.val();
        const oldValue = change.before.val()

        var isChanged = false
        var pushStat = false

        if (newValue.currentValue !== oldValue.currentValue) {
            //currentValue update trigger
            isChanged = true
            pushStat = true
        }

        // if the goal is completed push the notification to the database
        if (newValue.isCompleted !== oldValue.isCompleted) {
            if (newValue.isCompleted) {
                database.ref("/" + userId + "/notifications/").push({
                    type: "GOAL_COMPLETED",
                    date: Date.now(),
                    text: "Congratulations! You have completed goal '" + newValue.name + "'!"
                })
            } else {
                database.ref("/" + userId + "/notifications/").push({
                    type: "GOAL_UNCOMPLETED",
                    date: Date.now(),
                    text: "You have uncompleted goal '" + newValue.name + "'!"
                })
            }

        }

        //if the goal was archieved push the notification to the database
        if (newValue.isArchieved !== oldValue.isArchieved) {

            if (newValue.isArchieved) {
                database.ref("/" + userId + "/notifications/").push({
                    type: "GOAL_ARCHIEVED",
                    date: Date.now(),
                    text: "The goal '" + newValue.name + "' is archieved."
                })
            } else {
                database.ref("/" + userId + "/notifications/").push({
                    type: "GOAL_UNARCHIEVED",
                    date: Date.now(),
                    text: "The goal '" + newValue.name + "' is restored from archieve."
                })
            }

        }

        if (newValue.currentRepsValue !== oldValue.currentRepsValue) {
            //currentRepsValue update trigger
            isChanged = true
            pushStat = true
        }

        if (newValue.targetValue !== oldValue.targetValue) {
            //targetValue update trigger
            isChanged = true
        }

        if (newValue.targetRepsValue !== oldValue.targetRepsValue) {
            //targetRepsValue update trigger
            isChanged = true
        }



        if (isChanged) {
            //calculate the progress and put it to database
            console.log("Recalculating the PROGRESS!")
            var progress = 0;

            if (newValue.type === "weightreps") {
                //calculating the progress for weightreps
                progress = Math.abs(newValue.currentValue - newValue.startValue) / Math.abs(newValue.targetValue - newValue.startValue) * 100

                var repsDifference = newValue.currentRepsValue - newValue.targetRepsValue;
                var repsPercentage = 0

                if (repsDifference < 0) {
                    repsPercentage = 100 * (repsDifference / newValue.currentRepsValue - repsDifference / newValue.targetRepsValue) / 2
                } else {
                    repsPercentage = 100 * (repsDifference / newValue.targetRepsValue - repsDifference / newValue.currentRepsValue) / 2
                }


                //validating the repsPercentage
                if (repsPercentage > progress / 2) {
                    repsPercentage = progress / 2
                } else if (repsPercentage < progress / (-2)) {
                    repsPercentage = progress / (-2)
                }

                progress += repsPercentage;
                console.log("RepsDifference = " + repsDifference)
                console.log("RepsPercentage = " + repsPercentage)
                console.log("Progress = " + progress)

            } else {
                //calculating the normal progress
                progress = Math.abs(newValue.currentValue - newValue.startValue) / Math.abs(newValue.targetValue - newValue.startValue) * 100
            }

            //validating the progress
            if (Math.floor(progress) <= 0) {
                progress = 0
            } else if (Math.floor(progress) >= 100) {
                progress = 100

                console.log("Goal has reached 100%.")
                database.ref("/" + userId + "/goals/" + goalId + "/").update({
                    isCompleted: true
                })

                database.ref("/" + userId + "/notifications/").push({
                    type: "GOAL_COMPLETED",
                    date: Date.now(),
                    text: "You have reached 100% in '" + newValue.name + "'. Congrats!"
                })

            }

            //writing the progress to the database
            database.ref("/" + userId + "/goals/" + goalId + "/").update({
                progress: progress
            })


            //pushing the info to the stats
            if (pushStat) {
                database.ref("/" + userId + "/goals/" + goalId + "/stats/").push({
                    value: newValue.currentValue,
                    repsValue: newValue.currentRepsValue ? newValue.currentRepsValue : null,
                    progress: progress,
                    date: Date.now()
                })
            }


        }

    });

//goal created trigger
exports.goalCreated = functions.database.ref('/{userId}/goals/{goalId}/')
    .onCreate((snapshot, context) => {
        const userId = context.params.userId;
        const goalId = context.params.goalId;
        console.log("New goal " + goalId + " created!");
        console.log(snapshot.val().startValue)


        //Updating the progress
        var progress = 0;

        if (snapshot.val().type === "weightreps") {


            progress = Math.abs(snapshot.val().currentValue - snapshot.val().startValue) / Math.abs(snapshot.val().targetValue - snapshot.val().startValue) * 100

            var repsDifference = snapshot.val().currentRepsValue - snapshot.val().targetRepsValue;
            var repsPercentage = 0

            if (repsDifference < 0) {
                repsPercentage = 100 * (repsDifference / snapshot.val().currentRepsValue - repsDifference / snapshot.val().targetRepsValue) / 2
            } else {
                repsPercentage = 100 * (repsDifference / snapshot.val().targetRepsValue - repsDifference / snapshot.val().currentRepsValue) / 2
            }


            //validating the repsPercentage
            if (repsPercentage > progress / 2) {
                repsPercentage = progress / 2
            } else if (repsPercentage < progress / (-2)) {
                repsPercentage = progress / (-2)
            }

            progress += repsPercentage;
            console.log("RepsDifference = " + repsDifference)
            console.log("RepsPercentage = " + repsPercentage)
            console.log("Progress = " + progress)


        } else {
            progress = Math.abs(snapshot.val().currentValue - snapshot.val().startValue) / Math.abs(snapshot.val().targetValue - snapshot.val().startValue) * 100
        }

        if (Math.floor(progress) <= 0) {
            progress = 0
        } else if (Math.floor(progress) >= 100) {
            progress = 100

            console.log("Goal has reached 100%.")
            database.ref("/" + userId + "/goals/" + goalId + "/").update({
                isCompleted: true
            })

            database.ref("/" + userId + "/notifications/").push({
                type: "GOAL_COMPLETED",
                date: Date.now(),
                text: "You have reached 100% in '" + snapshot.val().name + "'. Congrats!"
            })

        }

        database.ref("/" + userId + "/goals/" + goalId + "/").update({
            progress: Math.round(progress)
        })

        //Updating the progress END

        //push new stats into the database (goal/stats)
        if (snapshot.val().startValue !== "") {
            database.ref("/" + userId + "/goals/" + goalId + "/stats/").push({
                value: snapshot.val().startValue,
                repsValue: snapshot.val().currentRepsValue ? snapshot.val().currentRepsValue : null,
                progress: progress,
                date: Date.now()
            })
        }

        //pushing new notification into database that the goal has been created
        return database.ref("/" + userId + "/notifications/").push({
            type: "GOAL_CREATED",
            date: Date.now(),
            text: "Goal '" + snapshot.val().name + "' has been created!"
        })
    });



//goal deleted trigger
exports.goalDeleted = functions.database.ref('/{userId}/goals/{goalId}/')
    .onDelete((snapshot, context) => {
        const userId = context.params.userId;
        const goalId = context.params.goalId;
        console.log("Goal " + goalId + " has been deleted!");
        console.log();

        return database.ref("/" + userId + "/notifications/").push({
            type: "GOAL_DELETED",
            date: Date.now(),
            text: "Goal '" + snapshot.val().name + "' has been deleted!"
        })
    })

    //user general info update trigger
exports.generalUpdated = functions.database.ref('/{userId}/general/')
    .onUpdate((change, context) => {
        const userId = context.params.userId;
        const goalId = context.params.goalId;
        const oldValue = change.before.val()
        const newValue = change.after.val()

        //name change trigger
        if (newValue.name !== oldValue.name)
        {
            database.ref("/" + userId + "/notifications/").push({
                type: "USERNAME_CHANGED",
                date: Date.now(),
                text: "You have successfully changed your name on '"+newValue.name+"'."
            })
        }

        //photo url changed trigger
        if (newValue.photoUrl !== oldValue.photoUrl)
        {
            database.ref("/" + userId + "/notifications/").push({
                type: "USERAVATAR_CHANGED",
                date: Date.now(),
                text: "You have successfully updater your profile photo."
            })
        }

        
    })





