import {Injectable} from '@angular/core';
import {kanbanDb} from './kanbandb';
import {IColumn} from './interfaces/column.interface';
import {ITicket} from './interfaces/ticket.interface';

@Injectable({
  providedIn: 'root'
})

// service for indexed db using the dexie library
export class KanbanService {

  /*
  * returns all columns with their tickets from indexed db
  * */
  async fetchColumns(): Promise<IColumn[]> {
    const columns: IColumn[] = await kanbanDb.columns.toArray();

    return Promise.all(columns.map(async (col: IColumn) => {
      col.item = (await kanbanDb.tickets
        .where('columnId')
        .anyOf(+col.id)
        .sortBy('order'));
      return col;
    })).then((cols: IColumn[]) => cols);
  }

  /*
  * @parameters:
  * id of the ticket.
  * returns the corresponding ticket of the given id from indexed db
  * */
  async fetchTicket(id: any): Promise<ITicket> {
    return await kanbanDb.tickets.get(+id);
  }

  /*
  * @parameters:
  * ticket: to be stored
  * stores a given ticket in indexed db
  * */
  async storeTicket(ticket: ITicket): Promise<ITicket> {
    const ticketId = await kanbanDb.tickets.add(ticket);
    return (await this.fetchTicket(ticketId));
  }

  /*
  * @parameters
  * ticket: to be updated
  * updates a specific ticket in indexed db
  * returns the updated ticket from indexed db
  * */
  async updateTicket(ticket: ITicket): Promise<ITicket> {
    ticket.id = +ticket.id;
    const isUpdated = await kanbanDb.tickets.update(ticket.id, ticket);
    return (await this.fetchTicket(ticket.id));
  }

  /*
  * @parameters:
  * delete an element based on the given id from indexed db
  * */
  async destroyElement(id: any): Promise<number> {
    const isDestroyed = (await kanbanDb.tickets.where('id').anyOf(+id).delete());
    return id;
  }

  /*
  * this method will make a batch update which will update
  * all the elements in the received tickets array
  * */
  async batchUpdate(tickets: ITicket[]) {
    await kanbanDb.tickets.bulkPut(tickets);
    return tickets;
  }
}
