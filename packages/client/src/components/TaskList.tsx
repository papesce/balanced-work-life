import React, { Component } from 'react'

const sampleTaskList = [
    {id:1, name:'aveirguar por internet para miralagos (semana de febrero)'}
]


export default class TaskList extends Component {
    render() {
        return (
            <ul>
            {sampleTaskList.map(task => 
                <li key={task.id}>{task.name}</li>
            )}
            </ul>
        )
    }
}
